import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveProctoringAdapter, type NativeProctoringFact, type NativeProctoringStatus, type ProctoringAdapter, type ProctoringPermissionStatus } from '@/platform/proctoring'
import {
  proctoringApi,
  type StrictProctoringDecision,
  type StrictProctoringPolicy,
  type StrictProctoringSession,
} from '@/shared/api/endpoints/proctoring'

export type ExamProctoringPolicy = Omit<StrictProctoringPolicy, 'requireMicrophone'> & {
  enabled: boolean
  requireMic: boolean
}

export type StrictProctoringPhase =
  | 'not_required'
  | 'notice'
  | 'preparing'
  | 'permission_denied'
  | 'identity_failed'
  | 'active'
  | 'interrupted'
  | 'review_required'
  | 'completed'
  | 'error'

type ProctoringApi = typeof proctoringApi

const sensorState = (status: NativeProctoringStatus, isOnline: boolean) => ({
  camera: status.camera,
  microphone: status.microphone,
  app: status.app,
  network: isOnline ? ('online' as const) : ('offline' as const),
  faceCount: status.faceCount,
  light: status.light,
  screenCaptured: status.screenCaptured,
})

const phaseForDecision = (decision: StrictProctoringDecision): StrictProctoringPhase => {
  if (decision.state === 'active' && decision.mayContinue) return 'active'
  if (decision.state === 'interrupted') return 'interrupted'
  if (decision.state === 'review_required') return 'review_required'
  if (decision.state === 'completed') return 'completed'
  return 'preparing'
}

export function useStrictProctoring(input: {
  examId?: number
  attemptId?: string
  policy?: ExamProctoringPolicy
  isOnline: boolean
  adapter?: ProctoringAdapter
  api?: ProctoringApi
}) {
  const { examId, attemptId, policy, isOnline } = input
  const required = Boolean(policy?.enabled && policy.level === 'strict' && examId && attemptId)
  const adapter = useMemo(() => input.adapter ?? resolveProctoringAdapter(), [input.adapter])
  const api = input.api ?? proctoringApi
  const [phase, setPhase] = useState<StrictProctoringPhase>(required ? 'notice' : 'not_required')
  const [permissions, setPermissions] = useState<ProctoringPermissionStatus | null>(null)
  const [status, setStatus] = useState<NativeProctoringStatus | null>(null)
  const [session, setSession] = useState<StrictProctoringSession | null>(null)
  const [decision, setDecision] = useState<StrictProctoringDecision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef<StrictProctoringSession | null>(null)
  const sequenceRef = useRef(0)
  const sendChainRef = useRef(Promise.resolve())
  const onlineRef = useRef(isOnline)
  onlineRef.current = isOnline

  const applySession = useCallback((next: StrictProctoringSession, nextDecision?: StrictProctoringDecision) => {
    sessionRef.current = next
    sequenceRef.current = Math.max(sequenceRef.current, next.lastSequence)
    setSession(next)
    if (nextDecision) {
      setDecision(nextDecision)
      setPhase(phaseForDecision(nextDecision))
    }
  }, [])

  useEffect(() => {
    if (!required) {
      setPhase('not_required')
      return
    }
    setPhase(current => (current === 'not_required' ? 'notice' : current))
  }, [required])

  const sendFact = useCallback(
    async (fact: NativeProctoringFact | { type: string; occurredAt: string; state: NativeProctoringStatus }) => {
      const current = sessionRef.current
      if (!current || !onlineRef.current) return
      const execute = async () => {
        const sequence = sequenceRef.current + 1
        const result = await api.reportFactualEvent(current.sessionId, {
          eventId: crypto.randomUUID(),
          type: fact.type,
          sequence,
          occurredAt: fact.occurredAt,
          state: sensorState(fact.state, onlineRef.current),
        })
        applySession(result.session, result.decision)
      }
      sendChainRef.current = sendChainRef.current.then(execute, execute)
      await sendChainRef.current
    },
    [api, applySession],
  )

  useEffect(() => {
    if (!required) return
    let active = true
    let remove: (() => void) | undefined
    void adapter.addFactListener(fact => {
      if (!active) return
      setStatus(fact.state)
      void sendFact(fact).catch(cause => {
        setError(String((cause as any)?.message || '监考事件同步失败'))
        setPhase('interrupted')
      })
    }).then(unsubscribe => {
      if (!active) unsubscribe()
      else remove = unsubscribe
    })
    return () => {
      active = false
      remove?.()
    }
  }, [adapter, required, sendFact])

  const begin = useCallback(
    async (consent: { accepted: boolean; biometricConsent: boolean; locale?: string }) => {
      if (!required || !examId || !attemptId || !policy) return
      if (!isOnline) {
        setError('严格监考必须联网开始')
        setPhase('interrupted')
        return
      }
      if (!consent.accepted || !consent.biometricConsent) {
        setError('请分别确认严格监考告知和人脸身份核验')
        return
      }
      setBusy(true)
      setError(null)
      setPhase('preparing')
      try {
        const consentResult = await api.createConsent({
          examId,
          attemptId,
          policyVersion: policy.policyVersion,
          noticeVersion: policy.noticeVersion,
          accepted: true,
          biometricConsent: true,
          categories: policy.notice?.categories || ['camera', 'microphone_status', 'identity_verification', 'factual_events'],
          locale: consent.locale,
        })
        const sessionResult = await api.createSession({
          examId,
          attemptId,
          consentId: consentResult.consent.consentId,
        })
        applySession(sessionResult.session, sessionResult.decision)

        const permissionResult = await adapter.requestPermissions()
        setPermissions(permissionResult)
        if (permissionResult.camera !== 'granted' || permissionResult.microphone !== 'granted') {
          setPhase('permission_denied')
          setError('严格监考需要摄像头和麦克风权限，当前不会静默降级')
          return
        }
        const started = await adapter.start()
        setStatus(started)
        if (started.camera !== 'available' || started.microphone !== 'available') {
          setPhase('interrupted')
          setError('摄像头或麦克风采集轨道未就绪')
          return
        }

        let activeSession = sessionRef.current || sessionResult.session
        if (activeSession.identityRequired && activeSession.identityStatus !== 'passed') {
          const frames = await adapter.captureIdentityFrames()
          const identity = await api.verifyIdentity(activeSession.sessionId, frames)
          applySession(identity.session, identity.decision)
          activeSession = identity.session
          if (identity.result.result !== 'passed') {
            setPhase(identity.decision.state === 'review_required' ? 'review_required' : 'identity_failed')
            setError(`身份核验未通过：${identity.result.reasonCode || 'UNKNOWN'}`)
            return
          }
        }
        if (activeSession.state === 'prepared') {
          await sendFact({ type: 'session_started', occurredAt: new Date().toISOString(), state: started })
        } else {
          const heartbeat = await api.heartbeat(activeSession.sessionId, sensorState(started, true))
          applySession(heartbeat.session, heartbeat.decision)
        }
      } catch (cause: any) {
        const message = String(cause?.message || '严格监考准备失败')
        setError(message)
        setPhase(/permission/i.test(message) ? 'permission_denied' : 'error')
      } finally {
        setBusy(false)
      }
    },
    [adapter, api, applySession, attemptId, examId, isOnline, policy, required, sendFact],
  )

  useEffect(() => {
    if (!required || !session || (phase !== 'active' && phase !== 'interrupted')) return
    const intervalMs = Math.max(10, policy?.heartbeatIntervalSeconds || 15) * 1000
    let cancelled = false
    const heartbeat = async () => {
      if (!onlineRef.current || cancelled) {
        if (!cancelled) setPhase('interrupted')
        return
      }
      try {
        const currentStatus = await adapter.status()
        if (cancelled) return
        setStatus(currentStatus)
        const result = await api.heartbeat(session.sessionId, sensorState(currentStatus, true))
        if (!cancelled) applySession(result.session, result.decision)
      } catch (cause: any) {
        if (!cancelled) {
          setError(String(cause?.message || '监考心跳失败'))
          setPhase('interrupted')
        }
      }
    }
    const timer = window.setInterval(() => void heartbeat(), intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [adapter, api, applySession, phase, policy?.heartbeatIntervalSeconds, required, session])

  useEffect(() => {
    if (!required || !sessionRef.current) return
    if (!isOnline) {
      setPhase('interrupted')
      setDecision({ state: 'interrupted', mayContinue: false, action: 'remain_paused', reasonCode: 'NETWORK_LOST' })
    }
  }, [isOnline, required])

  const complete = useCallback(async () => {
    const current = sessionRef.current
    if (!required || !current || current.state === 'completed') return
    const currentStatus = await adapter.status()
    const result = await api.complete(current.sessionId, {
      eventId: crypto.randomUUID(),
      sequence: sequenceRef.current + 1,
      occurredAt: new Date().toISOString(),
      state: sensorState(currentStatus, onlineRef.current),
    })
    applySession(result.session, result.decision)
    await adapter.stop()
  }, [adapter, api, applySession, required])

  useEffect(() => () => {
    if (required) void adapter.stop()
  }, [adapter, required])

  return {
    required,
    phase,
    permissions,
    status,
    session,
    decision,
    error,
    busy,
    canAnswer: !required || phase === 'active',
    begin,
    complete,
    openSettings: adapter.openSettings,
  }
}
