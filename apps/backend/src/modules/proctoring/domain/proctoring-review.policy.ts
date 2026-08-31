export type ReviewCaseStatus =
  | 'pending_review'
  | 'information_requested'
  | 'decided'
  | 'appeal_pending'
  | 'appeal_resolved'

export type ReviewOutcome = 'pending' | 'cleared' | 'violation_confirmed'

export type ReviewAction =
  | 'request_information'
  | 'candidate_response'
  | 'clear'
  | 'confirm_violation'
  | 'submit_appeal'
  | 'resolve_appeal_upheld'
  | 'resolve_appeal_rejected'

export type ReviewCaseProjection = {
  status: ReviewCaseStatus
  outcome: ReviewOutcome
  version: number
  firstDecidedAt: string | null
  appealDeadlineAt: string | null
  closedAt: string | null
  updatedAt: string
}

export type ReviewTransitionCommand = {
  action: ReviewAction
  expectedVersion: number
}

export type ReviewReasonCode =
  | 'SENSOR_INTERRUPTION_EXPLAINED'
  | 'IDENTITY_CONFIRMED_MANUALLY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'MULTIPLE_PERSONS_CONFIRMED'
  | 'SCREEN_CAPTURE_CONFIRMED'
  | 'IDENTITY_MISMATCH_CONFIRMED'
  | 'UNRESOLVED_SENSOR_INTERRUPTION'
  | 'CANDIDATE_EXPLANATION_REQUIRED'
  | 'APPEAL_EVIDENCE_ACCEPTED'
  | 'APPEAL_EVIDENCE_REJECTED'

export type AppealReasonCode =
  | 'DEVICE_INTERRUPTION'
  | 'ENVIRONMENTAL_CAUSE'
  | 'IDENTITY_ERROR'
  | 'EVENT_MISINTERPRETED'
  | 'OTHER'

export type StaffReviewAction = Exclude<ReviewAction, 'candidate_response' | 'submit_appeal'>

export class ProctoringReviewPolicyError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'ProctoringReviewPolicyError'
  }
}

const REVIEW_REASON_BY_ACTION: Record<StaffReviewAction, ReadonlySet<ReviewReasonCode>> = {
  request_information: new Set(['CANDIDATE_EXPLANATION_REQUIRED']),
  clear: new Set(['SENSOR_INTERRUPTION_EXPLAINED', 'IDENTITY_CONFIRMED_MANUALLY', 'INSUFFICIENT_EVIDENCE']),
  confirm_violation: new Set([
    'MULTIPLE_PERSONS_CONFIRMED',
    'SCREEN_CAPTURE_CONFIRMED',
    'IDENTITY_MISMATCH_CONFIRMED',
    'UNRESOLVED_SENSOR_INTERRUPTION',
  ]),
  resolve_appeal_upheld: new Set(['APPEAL_EVIDENCE_ACCEPTED']),
  resolve_appeal_rejected: new Set(['APPEAL_EVIDENCE_REJECTED']),
}

const APPEAL_REASON_CODES = new Set<AppealReasonCode>([
  'DEVICE_INTERRUPTION',
  'ENVIRONMENTAL_CAUSE',
  'IDENTITY_ERROR',
  'EVENT_MISINTERPRETED',
  'OTHER',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeReviewText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ProctoringReviewPolicyError('说明内容不能为空', 'PROCTORING_REVIEW_TEXT_REQUIRED')
  }
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim()
  if (!normalized) {
    throw new ProctoringReviewPolicyError('说明内容不能为空', 'PROCTORING_REVIEW_TEXT_REQUIRED')
  }
  if ([...normalized].length > 1000) {
    throw new ProctoringReviewPolicyError('说明内容不能超过 1000 个字符', 'PROCTORING_REVIEW_TEXT_TOO_LONG')
  }
  return normalized
}

export function validateDecisionReason(action: StaffReviewAction, value: unknown): ReviewReasonCode {
  const normalized = String(value ?? '').trim().toUpperCase() as ReviewReasonCode
  if (!REVIEW_REASON_BY_ACTION[action]?.has(normalized)) {
    throw new ProctoringReviewPolicyError('复核原因与当前操作不匹配', 'PROCTORING_REVIEW_REASON_NOT_ALLOWED')
  }
  return normalized
}

export function normalizeAppealReasonCode(value: unknown): AppealReasonCode {
  const normalized = String(value ?? '').trim().toUpperCase() as AppealReasonCode
  if (!APPEAL_REASON_CODES.has(normalized)) {
    throw new ProctoringReviewPolicyError('申诉原因无效', 'PROCTORING_REVIEW_APPEAL_REASON_INVALID')
  }
  return normalized
}

export function normalizeReviewUuid(value: unknown, label = '操作编号'): string {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!UUID_RE.test(normalized)) {
    throw new ProctoringReviewPolicyError(`${label}无效`, 'PROCTORING_REVIEW_UUID_INVALID')
  }
  return normalized
}

const stableSerialize = (value: unknown): string => {
  if (value === null) return 'null'
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null'
    case 'undefined':
      return 'null'
    case 'object': {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
      return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`).join(',')}}`
    }
    default:
      throw new ProctoringReviewPolicyError('请求内容无法生成摘要', 'PROCTORING_REVIEW_DIGEST_INPUT_INVALID')
  }
}

export function reviewRequestDigest(payload: unknown): string {
  return createHash('sha256').update(stableSerialize(payload)).digest('hex')
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value)
  const protectedValue = raw.replace(/^(\s*)([=+\-@])/, "$1'$2")
  return `"${protectedValue.replace(/"/g, '""')}"`
}

const stateConflict = (): never => {
  throw new ProctoringReviewPolicyError('当前案件状态不允许此操作', 'PROCTORING_REVIEW_STATE_CONFLICT', 409)
}

export function transitionReviewCase(
  current: ReviewCaseProjection,
  command: ReviewTransitionCommand,
  now = new Date(),
): ReviewCaseProjection {
  if (current.version !== command.expectedVersion) {
    throw new ProctoringReviewPolicyError('案件已被其他考务人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
  }

  const nowIso = now.toISOString()
  const next = { ...current, version: current.version + 1, updatedAt: nowIso }

  switch (command.action) {
    case 'request_information':
      if (current.status !== 'pending_review') return stateConflict()
      return { ...next, status: 'information_requested' }

    case 'candidate_response':
      if (current.status !== 'information_requested') return stateConflict()
      return { ...next, status: 'pending_review' }

    case 'clear':
      if (current.status !== 'pending_review') return stateConflict()
      return {
        ...next,
        status: 'decided',
        outcome: 'cleared',
        firstDecidedAt: current.firstDecidedAt ?? nowIso,
        appealDeadlineAt: null,
        closedAt: nowIso,
      }

    case 'confirm_violation':
      if (current.status !== 'pending_review') return stateConflict()
      return {
        ...next,
        status: 'decided',
        outcome: 'violation_confirmed',
        firstDecidedAt: current.firstDecidedAt ?? nowIso,
        appealDeadlineAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        closedAt: null,
      }

    case 'submit_appeal': {
      if (current.status !== 'decided' || current.outcome !== 'violation_confirmed' || !current.appealDeadlineAt) {
        return stateConflict()
      }
      const deadline = new Date(current.appealDeadlineAt)
      if (Number.isNaN(deadline.getTime()) || now.getTime() > deadline.getTime()) {
        throw new ProctoringReviewPolicyError('申诉期限已过', 'PROCTORING_REVIEW_APPEAL_EXPIRED', 409)
      }
      return { ...next, status: 'appeal_pending' }
    }

    case 'resolve_appeal_upheld':
      if (current.status !== 'appeal_pending') return stateConflict()
      return { ...next, status: 'appeal_resolved', outcome: 'cleared', closedAt: nowIso }

    case 'resolve_appeal_rejected':
      if (current.status !== 'appeal_pending') return stateConflict()
      return { ...next, status: 'appeal_resolved', outcome: 'violation_confirmed', closedAt: nowIso }
  }
}
import { createHash } from 'node:crypto'
