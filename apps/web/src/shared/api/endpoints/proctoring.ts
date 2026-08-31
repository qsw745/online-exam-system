import { api } from '../core/httpClient'

export type ProctoringSeverity = 'info' | 'warn' | 'critical'
export type StrictProctoringSessionState = 'prepared' | 'active' | 'interrupted' | 'review_required' | 'completed'

export type StrictProctoringPolicy = {
  level: 'off' | 'strict'
  policyVersion: string
  noticeVersion: string
  requireCamera: boolean
  requireMicrophone: boolean
  requireIdentityVerification: boolean
  eventRetentionDays: number
  snapshotRetentionDays: number
  heartbeatIntervalSeconds: number
  interruptionGraceSeconds: number
  notice?: {
    categories: string[]
    purpose: string
    processingLocation: string
    cameraUsage: string
    microphoneUsage: string
    mediaUpload: string
    eventRetentionDays: number
    snapshotRetentionDays: number
  }
}

export type StrictProctoringSession = {
  sessionId: string
  consentId: string
  attemptId: string
  examId: number
  taskId: number | null
  state: StrictProctoringSessionState
  lastSequence: number
  cameraRequired: boolean
  microphoneRequired: boolean
  identityRequired: boolean
  identityStatus: 'pending' | 'passed' | 'failed' | 'not_required'
  startedAt: string | null
  lastHeartbeatAt: string | null
  interruptionStartedAt: string | null
  completedAt: string | null
  reviewReasonCode: string | null
}

export type StrictProctoringDecision = {
  state: StrictProctoringSessionState
  mayContinue: boolean
  action: 'continue' | 'remain_paused' | 'manual_review' | 'completed'
  reasonCode?: string | null
}

export type ProctoringSensorState = {
  camera: 'available' | 'interrupted' | 'denied' | 'unavailable'
  microphone: 'available' | 'interrupted' | 'denied' | 'unavailable'
  app: 'foreground' | 'background'
  network: 'online' | 'offline'
  faceCount?: 0 | 1 | 2
  light?: 'normal' | 'dark'
  screenCaptured?: boolean
}

export type ProctoringEvent = {
  id: number
  exam_id: number
  user_id: number
  severity: ProctoringSeverity
  type: string
  message: string | null
  meta?: any
  occurred_at?: string | null
  created_at: string
}

export type ProctoringSummary = {
  total: number
  info: number
  warn: number
  critical: number
}

export type ProctoringList = {
  items: ProctoringEvent[]
  total: number
  page: number
  limit: number
  summary: ProctoringSummary
}

function unwrap(res: any): any {
  if (!res) return res
  if (typeof res === 'object') {
    if ('ok' in res) {
      if (res.ok) return res.data ?? res.result ?? res.payload ?? {}
      throw new Error(res?.message || '请求失败')
    }
    if ('data' in res) return (res as any).data
  }
  return res
}

export const proctoringApi = {
  async createConsent(payload: {
    examId: number
    attemptId: string
    policyVersion: string
    noticeVersion: string
    accepted: true
    biometricConsent: true
    categories: string[]
    locale?: string
  }) {
    return unwrap(await api.post('/proctoring/consents', payload)) as {
      consent: { consentId: string; expiresAt: string }
      policy: StrictProctoringPolicy
      replayed: boolean
    }
  },

  async createSession(payload: { examId: number; attemptId: string; consentId: string }) {
    return unwrap(await api.post('/proctoring/sessions', payload)) as {
      session: StrictProctoringSession
      policy: StrictProctoringPolicy
      decision: StrictProctoringDecision
      replayed: boolean
    }
  },

  async getSession(sessionId: string) {
    return unwrap(await api.get(`/proctoring/sessions/${sessionId}`)) as {
      session: StrictProctoringSession
      decision: StrictProctoringDecision
    }
  },

  async reportFactualEvent(sessionId: string, payload: {
    eventId: string
    type: string
    sequence: number
    occurredAt: string
    state: Partial<ProctoringSensorState>
  }) {
    return unwrap(await api.post(`/proctoring/sessions/${sessionId}/events`, payload)) as {
      session: StrictProctoringSession
      decision: StrictProctoringDecision
      replayed: boolean
    }
  },

  async heartbeat(sessionId: string, state: ProctoringSensorState) {
    return unwrap(await api.post(`/proctoring/sessions/${sessionId}/heartbeat`, state)) as {
      session: StrictProctoringSession
      decision: StrictProctoringDecision
      serverNow: string
    }
  },

  async verifyIdentity(sessionId: string, images: string[]) {
    return unwrap(await api.post(`/proctoring/sessions/${sessionId}/identity-check`, { images }, { timeout: 60000 })) as {
      session: StrictProctoringSession
      decision: StrictProctoringDecision
      result: {
        checkId?: string
        result: 'passed' | 'failed'
        reasonCode: string | null
        similarity?: number | null
      }
      replayed?: boolean
    }
  },

  async complete(sessionId: string, payload: {
    eventId: string
    sequence: number
    occurredAt: string
    state: Partial<ProctoringSensorState>
  }) {
    return unwrap(await api.post(`/proctoring/sessions/${sessionId}/complete`, payload)) as {
      session: StrictProctoringSession
      decision: StrictProctoringDecision
      replayed: boolean
    }
  },

  async listExamEvents(examId: string | number, params?: { page?: number; limit?: number; severity?: string }) {
    const res = await api.get(`/proctoring/exams/${examId}`, { params })
    const payload = unwrap(res)
    const items = payload?.items ?? payload?.data?.items ?? []
    const summary = payload?.summary ?? payload?.data?.summary ?? { total: 0, info: 0, warn: 0, critical: 0 }
    return {
      items,
      summary,
      total: Number(payload?.total ?? items.length ?? 0),
      page: Number(payload?.page ?? 1),
      limit: Number(payload?.limit ?? items.length ?? 10),
    } as ProctoringList
  },
}

export default proctoringApi
