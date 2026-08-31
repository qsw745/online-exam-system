export type AuthoritativeDeadlineClock = {
  remainingAtSyncMs: number
  syncedMonotonicMs: number
}

export type PendingSubmissionReason = 'manual' | 'deadline' | 'anti_cheat'

export type PendingExamSubmission = {
  attemptId: string
  submissionId: string
  answers: Record<string, string>
  timeSpent: number
  reason: PendingSubmissionReason
  createdAt: string
}

export function createAuthoritativeDeadlineClock(input: {
  serverNow: string
  deadlineAt: string
  monotonicNowMs?: number
}): AuthoritativeDeadlineClock {
  const serverNowMs = Date.parse(input.serverNow)
  const deadlineAtMs = Date.parse(input.deadlineAt)
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(deadlineAtMs)) {
    throw new Error('服务端考试时间无效')
  }
  return {
    remainingAtSyncMs: Math.max(0, deadlineAtMs - serverNowMs),
    syncedMonotonicMs: input.monotonicNowMs ?? performance.now(),
  }
}

export function remainingSeconds(clock: AuthoritativeDeadlineClock, monotonicNowMs = performance.now()) {
  const elapsedMs = Math.max(0, monotonicNowMs - clock.syncedMonotonicMs)
  return Math.max(0, Math.floor((clock.remainingAtSyncMs - elapsedMs) / 1000))
}

function newSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('当前环境无法生成安全提交编号')
}

export function createPendingSubmission(
  input: {
    attemptId: string
    answers: Readonly<Record<string | number, string>>
    timeSpent: number
    reason: PendingSubmissionReason
  },
  createId: () => string = newSubmissionId,
  now: () => string = () => new Date().toISOString(),
): PendingExamSubmission {
  return {
    attemptId: input.attemptId,
    submissionId: createId(),
    answers: Object.fromEntries(
      Object.entries(input.answers).map(([key, value]) => [String(key), String(value)]),
    ),
    timeSpent: Math.max(0, Math.floor(Number(input.timeSpent) || 0)),
    reason: input.reason,
    createdAt: now(),
  }
}
