import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearExamDraft,
  examDraftKey,
  readExamDraft,
  saveExamDraft,
  type ExamDraftIdentity,
  type ExamDraftState,
} from '../draft/examDraft'

export type ExamDraftStatus = 'idle' | 'restored' | 'saved' | 'unavailable'

type UseExamDraftOptions = {
  identity: ExamDraftIdentity | null
  answers: Readonly<Record<string | number, string>>
  flagged: number[]
  onRestore?: (state: ExamDraftState) => void
  storage?: Storage
  delayMs?: number
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useExamDraft({
  identity,
  answers,
  flagged,
  onRestore,
  storage,
  delayMs = 500,
}: UseExamDraftOptions) {
  const resolvedStorage = useMemo(() => storage ?? getBrowserStorage(), [storage])
  const identityKey = useMemo(
    () => (identity ? examDraftKey(identity) : null),
    [identity?.examId, identity?.taskId, identity?.userId],
  )
  const answerSignature = useMemo(() => JSON.stringify(answers), [answers])
  const flaggedSignature = [...flagged].sort((a, b) => a - b).join(',')
  const [status, setStatus] = useState<ExamDraftStatus>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const latestRef = useRef({ identity, answers, flagged })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearedRef = useRef(false)
  const restoredKeyRef = useRef<string | null>(null)

  latestRef.current = { identity, answers, flagged }

  const flushDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    const latest = latestRef.current
    if (!resolvedStorage || !latest.identity || clearedRef.current) return

    const normalizedAnswers = Object.fromEntries(
      Object.entries(latest.answers).map(([key, value]) => [String(key), value]),
    )
    const result = saveExamDraft(resolvedStorage, latest.identity, {
      answers: normalizedAnswers,
      flagged: [...latest.flagged],
    })
    if (result.ok) {
      setStatus('saved')
      setSavedAt(result.savedAt)
    } else {
      setStatus('unavailable')
    }
  }, [resolvedStorage])

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    clearedRef.current = true
    if (!resolvedStorage || !identity) return
    if (clearExamDraft(resolvedStorage, identity)) {
      setStatus('idle')
      setSavedAt(null)
    } else {
      setStatus('unavailable')
    }
  }, [identityKey, resolvedStorage])

  useEffect(() => {
    if (!identityKey || !identity) {
      restoredKeyRef.current = null
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

    restoredKeyRef.current = identityKey
    clearedRef.current = false
    const result = readExamDraft(resolvedStorage, identity)
    if (result.status === 'found') {
      const restored = { answers: result.draft.answers, flagged: result.draft.flagged }
      onRestore?.(restored)
      setStatus('restored')
      setSavedAt(result.draft.savedAt)
    } else if (result.status === 'unavailable') {
      setStatus('unavailable')
      setSavedAt(null)
    } else {
      setStatus('idle')
      setSavedAt(null)
    }
  }, [identity, identityKey, onRestore, resolvedStorage])

  useEffect(() => {
    if (!identityKey || !resolvedStorage || clearedRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flushDraft, delayMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [answerSignature, delayMs, flaggedSignature, flushDraft, identityKey, resolvedStorage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('pagehide', flushDraft)
    return () => window.removeEventListener('pagehide', flushDraft)
  }, [flushDraft])

  return { status, savedAt, clearDraft, flushDraft }
}

export default useExamDraft
