import type {
  AppealReasonCode,
  ReviewCaseProjection,
  ReviewCaseStatus,
  ReviewOutcome,
  ReviewReasonCode,
  StaffReviewAction,
} from './proctoring-review.policy.js'
import type { ProctoringDataRegion, ProctoringSessionState } from './proctoring.policy.js'

export type ReviewActor = {
  userId: number
  role: 'admin' | 'teacher'
  dataRegion: ProctoringDataRegion
  createdByUserId?: number
}

export type ReviewCaseListItem = ReviewCaseProjection & {
  caseId: string
  sessionId: string
  examId: number
  taskId: number | null
  attemptId: string
  userId: number
  candidatePublicId: string
  candidateDisplayName: string | null
  examTitle: string
  dataRegion: ProctoringDataRegion
  triggerReasonCode: string
  openedAt: string
  retainUntil: string
}

export type ReviewSessionSummary = {
  state: ProctoringSessionState
  identityStatus: 'pending' | 'passed' | 'failed' | 'not_required'
  startedAt: string | null
  lastHeartbeatAt: string | null
  interruptionStartedAt: string | null
  completedAt: string | null
}

export type ReviewIdentitySummary = {
  checkId: string
  result: 'passed' | 'failed'
  reasonCode: string | null
  similarity: number | null
  livenessPassed: boolean | null
  model: string | null
  checkedAt: string
}

export type ReviewEventSummary = {
  eventId: string
  sequence: number
  type: string
  severity: 'info' | 'warn' | 'critical'
  state: Record<string, unknown>
  occurredAt: string
  receivedAt: string
}

export type ReviewDecisionRecord = {
  decisionId: string
  actorUserId: number
  action: StaffReviewAction
  reasonCode: ReviewReasonCode
  comment: string
  caseVersionBefore: number
  caseVersionAfter: number
  createdAt: string
}

export type ReviewMessageRecord = {
  messageId: string
  actorUserId: number
  messageType: 'information_request' | 'candidate_response'
  replyToMessageId: string | null
  body: string
  caseVersionBefore: number
  caseVersionAfter: number
  createdAt: string
}

export type ReviewAppealRecord = {
  appealId: string
  userId: number
  reasonCode: AppealReasonCode
  statement: string
  status: 'pending' | 'upheld' | 'rejected'
  resolutionDecisionId: string | null
  submittedAt: string
  resolvedAt: string | null
}

export type ReviewCaseDetail = ReviewCaseListItem & {
  session: ReviewSessionSummary
  identityChecks: ReviewIdentitySummary[]
  events: ReviewEventSummary[]
  decisions: ReviewDecisionRecord[]
  messages: ReviewMessageRecord[]
  appeal: ReviewAppealRecord | null
}

export type CandidateReviewCaseListItem = Pick<
  ReviewCaseListItem,
  | 'caseId'
  | 'examId'
  | 'taskId'
  | 'attemptId'
  | 'examTitle'
  | 'status'
  | 'outcome'
  | 'triggerReasonCode'
  | 'version'
  | 'openedAt'
  | 'firstDecidedAt'
  | 'appealDeadlineAt'
  | 'closedAt'
  | 'updatedAt'
>

export type CandidateReviewDecisionRecord = Pick<
  ReviewDecisionRecord,
  'action' | 'reasonCode' | 'createdAt'
>

export type CandidateReviewMessageRecord = Pick<
  ReviewMessageRecord,
  'messageId' | 'messageType' | 'replyToMessageId' | 'body' | 'createdAt'
>

export type CandidateReviewAppealRecord = Pick<
  ReviewAppealRecord,
  'appealId' | 'reasonCode' | 'statement' | 'status' | 'submittedAt' | 'resolvedAt'
>

export type CandidateReviewCaseDetail = CandidateReviewCaseListItem & {
  decisions: CandidateReviewDecisionRecord[]
  messages: CandidateReviewMessageRecord[]
  appeal: CandidateReviewAppealRecord | null
}

export type ReviewCasePage<T = ReviewCaseListItem> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type StaffCaseQuery = {
  actor: ReviewActor
  status?: ReviewCaseStatus
  outcome?: ReviewOutcome
  examId?: number
  reasonCode?: string
  page: number
  limit: number
}

export type CandidateCaseQuery = {
  userId: number
  attemptId?: string
  page: number
  limit: number
}

export type ApplyDecisionInput = {
  actor: ReviewActor
  caseId: string
  decisionId: string
  action: StaffReviewAction
  reasonCode: ReviewReasonCode
  comment: string
  expectedVersion: number
  requestDigest: string
  messageId?: string
  informationRequest?: string
  nextCase: ReviewCaseProjection
}

export type AddCandidateResponseInput = {
  userId: number
  caseId: string
  messageId: string
  replyToMessageId: string
  body: string
  expectedVersion: number
  requestDigest: string
  nextCase: ReviewCaseProjection
}

export type AddAppealInput = {
  userId: number
  caseId: string
  appealId: string
  reasonCode: AppealReasonCode
  statement: string
  expectedVersion: number
  requestDigest: string
  nextCase: ReviewCaseProjection
}

export type ReviewWriteResult = {
  case: ReviewCaseDetail
  replayed: boolean
}

export type ReviewIdempotencyKind = 'decision' | 'message' | 'appeal'

export type ReviewStoredWrite = {
  kind: ReviewIdempotencyKind
  requestId: string
  requestDigest: string
  result: ReviewWriteResult
}

export interface ProctoringReviewRepositoryContract {
  listStaffCases(input: StaffCaseQuery): Promise<ReviewCasePage>
  listCandidateCases(input: CandidateCaseQuery): Promise<ReviewCasePage<CandidateReviewCaseListItem>>
  findCaseForStaff(caseId: string, actor: ReviewActor): Promise<ReviewCaseDetail | null>
  findCaseForCandidate(caseId: string, userId: number): Promise<ReviewCaseDetail | null>
  findStoredWrite(kind: ReviewIdempotencyKind, requestId: string): Promise<ReviewStoredWrite | null>
  applyDecision(input: ApplyDecisionInput): Promise<ReviewWriteResult>
  addCandidateResponse(input: AddCandidateResponseInput): Promise<ReviewWriteResult>
  addAppeal(input: AddAppealInput): Promise<ReviewWriteResult>
}
