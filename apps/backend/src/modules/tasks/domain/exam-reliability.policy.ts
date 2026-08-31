import { createHash } from 'node:crypto'

export type ExamSubmissionResult = {
  score: number
  correctCount: number
  questionCount: number
  examResultId: number
}

export type ExamReliabilityErrorCode =
  | 'INVALID_ATTEMPT_ID'
  | 'INVALID_SUBMISSION_ID'
  | 'ATTEMPT_MISMATCH'
  | 'SUBMISSION_PAYLOAD_MISMATCH'
  | 'EXAM_ALREADY_SUBMITTED'
  | 'EXAM_ATTEMPT_EXPIRED'

export class ExamReliabilityError extends Error {
  readonly httpStatus: number

  constructor(
    readonly code: ExamReliabilityErrorCode,
    message: string,
    httpStatus = 409,
  ) {
    super(message)
    this.name = 'ExamReliabilityError'
    this.httpStatus = httpStatus
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUuid(value: unknown, code: 'INVALID_ATTEMPT_ID' | 'INVALID_SUBMISSION_ID') {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!UUID_PATTERN.test(normalized)) {
    throw new ExamReliabilityError(
      code,
      code === 'INVALID_ATTEMPT_ID' ? '作答编号无效，请重新进入考试' : '提交编号无效，请重试',
      400,
    )
  }
  return normalized
}

export function normalizeSubmissionIdentity(attemptId: unknown, submissionId: unknown) {
  return {
    attemptId: normalizeUuid(attemptId, 'INVALID_ATTEMPT_ID'),
    submissionId: normalizeUuid(submissionId, 'INVALID_SUBMISSION_ID'),
  }
}

export function submissionPayloadHash(input: {
  attemptId: string
  answers: Record<string, string>
  timeSpent: number
}) {
  const normalizedAnswers = Object.fromEntries(
    Object.entries(input.answers ?? {})
      .map(([key, value]) => [String(key), String(value)] as const)
      .sort(([left], [right]) => left.localeCompare(right, 'en')),
  )
  const payload = JSON.stringify({
    attemptId: input.attemptId,
    answers: normalizedAnswers,
    timeSpent: Math.max(0, Math.floor(Number(input.timeSpent) || 0)),
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function decideSubmission(
  existing: {
    status: string
    submissionId: string | null
    payloadHash: string | null
    response: ExamSubmissionResult | null
  },
  incoming: { submissionId: string; payloadHash: string },
): { action: 'proceed' } | { action: 'replay'; response: ExamSubmissionResult } {
  const finished = existing.status === 'submitted' || existing.status === 'graded'
  if (!finished) return { action: 'proceed' }

  if (existing.submissionId !== incoming.submissionId) {
    throw new ExamReliabilityError('EXAM_ALREADY_SUBMITTED', '该考试已经交卷，不能再次提交')
  }
  if (existing.payloadHash !== incoming.payloadHash) {
    throw new ExamReliabilityError('SUBMISSION_PAYLOAD_MISMATCH', '同一提交编号的内容不一致，请勿修改后重试')
  }
  if (!existing.response) {
    throw new ExamReliabilityError('EXAM_ALREADY_SUBMITTED', '该考试已经交卷，成绩结果正在生成')
  }
  return { action: 'replay', response: existing.response }
}

export function calculateAttemptDeadline(input: {
  startedAt: string | Date
  durationMinutes: number
  examEndsAt?: string | Date | null
}) {
  const startedAt = new Date(input.startedAt)
  if (Number.isNaN(startedAt.getTime())) throw new Error('无效的考试开始时间')
  const durationDeadline = startedAt.getTime() + Math.max(0, input.durationMinutes) * 60_000
  const examDeadline = input.examEndsAt ? new Date(input.examEndsAt).getTime() : Number.POSITIVE_INFINITY
  return new Date(Math.min(durationDeadline, examDeadline)).toISOString()
}

export const OFFLINE_SUBMISSION_GRACE_SECONDS = 5 * 60

export function assertSubmissionWindow(
  deadlineAt: string | Date,
  receivedAt = new Date(),
  graceSeconds = OFFLINE_SUBMISSION_GRACE_SECONDS,
) {
  const deadlineMs = new Date(deadlineAt).getTime()
  if (!Number.isFinite(deadlineMs) || receivedAt.getTime() > deadlineMs + graceSeconds * 1000) {
    throw new ExamReliabilityError(
      'EXAM_ATTEMPT_EXPIRED',
      '交卷已超过离线补交宽限期，请联系监考人员处理',
    )
  }
}
