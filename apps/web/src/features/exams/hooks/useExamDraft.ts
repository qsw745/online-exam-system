import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveExamVaultAdapter, type ExamVaultAdapter } from '@/platform/exam-vault'
import {
  clearExamDraft,
  examDraftKey,
  readExamDraft,
  saveExamDraft,
  type ExamDraftIdentity,
  type ExamDraftState,
} from '../draft/examDraft'
import type { PendingExamSubmission } from '../reliability/examReliability'

export type ExamDraftStatus = 'idle' | 'restored' | 'saved' | 'unavailable'

type UseExamDraftOptions = {
  identity: ExamDraftIdentity | null
  answers: Readonly<Record<string | number, string>>
  flagged: number[]
  pendingSubmission?: PendingExamSubmission | null
  onRestore?: (state: ExamDraftState) => void
  storage?: ExamVaultAdapter | null
  delayMs?: number
}

export function useExamDraft({
  identity,
  answers,
  flagged,
  pendingSubmission = null,
  onRestore,
  storage,
  delayMs = 500,
}: UseExamDraftOptions) {
  const resolvedStorage = useMemo(() => storage === undefined ? resolveExamVaultAdapter() : storage, [storage])
  const identityKey = useMemo(
    () => (identity ? examDraftKey(identity) : null),
    [identity?.attemptId, identity?.examId, identity?.taskId, identity?.userId],
  )
  const answerSignature = useMemo(() => JSON.stringify(answers), [answers])
  const pendingSignature = useMemo(() => JSON.stringify(pendingSubmission), [pendingSubmission])
  const flaggedSignature = [...flagged].sort((a, b) => a - b).join(',')
  const [status, setStatus] = useState<ExamDraftStatus>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const latestRef = useRef({ identity, answers, flagged, pendingSubmission })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearedRef = useRef(false)
  const restoredKeyRef = useRef<string | null>(null)
  const writeChainRef = useRef<Promise<unknown>>(Promise.resolve())

  latestRef.current = { identity, answers, flagged, pendingSubmission }

  const queueWrite = useCallback(<T,>(operation: () => Promise<T>) => {
    const next = writeChainRef.current.then(operation, operation)
    writeChainRef.current = next.catch(() => undefined)
    return next
  }, [])

  const flushDraft = useCallback(async (override?: ExamDraftState) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    const latest = latestRef.current
    if (
      !resolvedStorage ||
      !latest.identity ||
      clearedRef.current ||
      restoredKeyRef.current !== examDraftKey(latest.identity)
    ) return false

    const state: ExamDraftState = override ?? {
      answers: Object.fromEntries(
        Object.entries(latest.answers).map(([key, value]) => [String(key), String(value)]),
      ),
      flagged: [...latest.flagged],
      pendingSubmission: latest.pendingSubmission,
    }
    const result = await queueWrite(() => saveExamDraft(resolvedStorage, latest.identity!, state))
    if (result.ok) {
      setStatus('saved')
      setSavedAt(result.savedAt)
      return true
    }
    setStatus('unavailable')
    return false
  }, [queueWrite, resolvedStorage])

  const clearDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    clearedRef.current = true
    if (!resolvedStorage || !identity) return false
    const cleared = await queueWrite(() => clearExamDraft(resolvedStorage, identity))
    if (cleared) {
      setStatus('idle')
      setSavedAt(null)
      return true
    }
    setStatus('unavailable')
    return false
  }, [identityKey, queueWrite, resolvedStorage])

  useEffect(() => {
    let cancelled = false
    if (!identityKey || !identity) {
      restoredKeyRef.current = null
      setReadyKey(null)
      clearedRef.current = false
      setStatus('idle')
      setSavedAt(null)
      return
    }
    if (!resolvedStorage) {
      setStatus('unavailable')
      return
    }
    if (restoredKeyRef.current === identityKey) return

    restoredKeyRef.current = null
    setReadyKey(null)
    clearedRef.current = false
    void readExamDraft(resolvedStorage, identity).then(result => {
      if (cancelled) return
      restoredKeyRef.current = identityKey
      if (result.status === 'found') {
        setReadyKey(identityKey)
        const restored: ExamDraftState = {
          answers: result.draft.answers,
          flagged: result.draft.flagged,
          pendingSubmission: result.draft.pendingSubmission,
        }
        onRestore?.(restored)
        setStatus('restored')
        setSavedAt(result.draft.savedAt)
      } else if (result.status === 'unavailable') {
        setReadyKey(null)
        setStatus('unavailable')
        setSavedAt(null)
      } else {
        setReadyKey(identityKey)
        setStatus('idle')
        setSavedAt(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [identity, identityKey, onRestore, resolvedStorage])

  useEffect(() => {
    if (!identityKey || !resolvedStorage || clearedRef.current || restoredKeyRef.current !== identityKey) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flushDraft(), delayMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [answerSignature, delayMs, flaggedSignature, flushDraft, identityKey, pendingSignature, readyKey, resolvedStorage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const persist = () => void flushDraft()
    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', persistWhenHidden)
    return () => {
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', persistWhenHidden)
    }
  }, [flushDraft])

  return { status, savedAt, ready: Boolean(identityKey && readyKey === identityKey), clearDraft, flushDraft }
}

export default useExamDraft
