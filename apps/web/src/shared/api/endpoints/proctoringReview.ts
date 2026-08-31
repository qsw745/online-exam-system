import { api } from '../core/httpClient'

export type ReviewCaseListItem = {
  caseId: string
  sessionId: string
  examId: number
  taskId: number | null
  attemptId: string
  userId: number
  candidatePublicId: string
  candidateDisplayName: string | null
  examTitle: string
  dataRegion: 'cn' | 'global'
  status: string
  outcome: string
  triggerReasonCode: string
  version: number
  openedAt: string
  firstDecidedAt: string | null
  appealDeadlineAt: string | null
  closedAt: string | null
  retainUntil: string
  updatedAt: string
}

export type ReviewDecision = {
  decisionId: string
  actorUserId: number
  action: string
  reasonCode: string
  comment: string
  caseVersionBefore: number
  caseVersionAfter: number
  createdAt: string
}

export type ReviewMessage = {
  messageId: string
  actorUserId: number
  messageType: 'information_request' | 'candidate_response'
  replyToMessageId: string | null
  body: string
  caseVersionBefore: number
  caseVersionAfter: number
  createdAt: string
}

export type ReviewAppeal = {
  appealId: string
  userId: number
  reasonCode: string
  statement: string
  status: 'pending' | 'upheld' | 'rejected'
  resolutionDecisionId: string | null
  submittedAt: string
  resolvedAt: string | null
}

export type ReviewCaseDetail = ReviewCaseListItem & {
  session: {
    state: string
    identityStatus: string
    startedAt: string | null
    lastHeartbeatAt: string | null
    interruptionStartedAt: string | null
    completedAt: string | null
  }
  identityChecks: Array<{
    checkId: string
    result: string
    reasonCode: string | null
    similarity: number | null
    livenessPassed: boolean | null
    model: string | null
    checkedAt: string
  }>
  events: Array<{
    eventId: string
    sequence: number
    type: string
    severity: 'info' | 'warn' | 'critical'
    state: Record<string, unknown>
    occurredAt: string
    receivedAt: string
  }>
  decisions: ReviewDecision[]
  messages: ReviewMessage[]
  appeal: ReviewAppeal | null
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

export type CandidateReviewDecision = Pick<ReviewDecision, 'action' | 'reasonCode' | 'createdAt'>

export type CandidateReviewMessage = Pick<
  ReviewMessage,
  'messageId' | 'messageType' | 'replyToMessageId' | 'body' | 'createdAt'
>

export type CandidateReviewAppeal = Pick<
  ReviewAppeal,
  'appealId' | 'reasonCode' | 'statement' | 'status' | 'submittedAt' | 'resolvedAt'
>

export type CandidateReviewCaseDetail = CandidateReviewCaseListItem & {
  decisions: CandidateReviewDecision[]
  messages: CandidateReviewMessage[]
  appeal: CandidateReviewAppeal | null
}

export type CandidateReviewWriteResult = {
  case: CandidateReviewCaseDetail
  replayed: boolean
}

export type ReviewCasePage<T = ReviewCaseListItem> = {
  items: T[]
  total: number
  page: number
  limit: number
}

type ApiResult<T> = { success?: boolean; data?: T; error?: string; code?: string; status?: number }

function unwrap<T>(result: ApiResult<T> | T): T {
  if (result && typeof result === 'object' && 'success' in result) {
    const wrapped = result as ApiResult<T>
    if (wrapped.success === false) {
      throw Object.assign(new Error(wrapped.error || '请求失败'), { code: wrapped.code, status: wrapped.status })
    }
    return wrapped.data as T
  }
  return result as T
}

export const proctoringReviewApi = {
  async listStaffCases(params: {
    status?: string
    outcome?: string
    examId?: number
    reasonCode?: string
    page?: number
    limit?: number
  }) {
    return unwrap<ReviewCasePage>(await api.get('/proctoring/review-cases', { params }))
  },

  async getStaffCase(caseId: string) {
    return unwrap<ReviewCaseDetail>(await api.get(`/proctoring/review-cases/${caseId}`))
  },

  async decideCase(caseId: string, payload: Record<string, unknown>) {
    return unwrap<{ case: ReviewCaseDetail; replayed: boolean }>(
      await api.post(`/proctoring/review-cases/${caseId}/decisions`, payload),
    )
  },

  async exportCaseCsv(caseId: string) {
    return unwrap<Blob>(
      await api.get(`/proctoring/review-cases/${caseId}/export.csv`, { responseType: 'blob' as const }),
    )
  },

  async listMyCases(params: { attemptId?: string; page?: number; limit?: number } = {}) {
    return unwrap<ReviewCasePage<CandidateReviewCaseListItem>>(
      await api.get('/proctoring/my-review-cases', { params }),
    )
  },

  async getMyCase(caseId: string) {
    return unwrap<CandidateReviewCaseDetail>(await api.get(`/proctoring/my-review-cases/${caseId}`))
  },

  async respond(caseId: string, payload: Record<string, unknown>) {
    return unwrap<CandidateReviewWriteResult>(
      await api.post(`/proctoring/my-review-cases/${caseId}/responses`, payload),
    )
  },

  async appeal(caseId: string, payload: Record<string, unknown>) {
    return unwrap<CandidateReviewWriteResult>(
      await api.post(`/proctoring/my-review-cases/${caseId}/appeals`, payload),
    )
  },
}

export default proctoringReviewApi
