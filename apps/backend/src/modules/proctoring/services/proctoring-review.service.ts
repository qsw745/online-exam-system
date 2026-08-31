import type { AuthUser } from '@/types/auth'
import type { Request } from 'express'
import { buildReviewCaseCsv } from '../domain/proctoring-review.csv.js'
import type {
  CandidateReviewCaseListItem,
  CandidateReviewCaseDetail,
  ProctoringReviewRepositoryContract,
  ReviewActor,
  ReviewCaseDetail,
  ReviewCasePage,
  ReviewIdempotencyKind,
  ReviewWriteResult,
  StaffCaseQuery,
} from '../domain/proctoring-review.model.js'
import {
  normalizeAppealReasonCode,
  normalizeReviewText,
  normalizeReviewUuid,
  ProctoringReviewPolicyError,
  reviewRequestDigest,
  transitionReviewCase,
  validateDecisionReason,
  type AppealReasonCode,
  type ReviewAction,
  type ReviewCaseStatus,
  type ReviewOutcome,
  type ReviewReasonCode,
  type StaffReviewAction,
} from '../domain/proctoring-review.policy.js'

type ReviewAuthUser = AuthUser & {
  roles?: Array<{ id?: number; code?: string } | string>
  role_ids?: number[]
  is_admin?: boolean
  is_super_admin?: boolean
  isAdmin?: boolean
  isSuperAdmin?: boolean
}

const notFound = (): never => {
  throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
}

const requireUserId = (user?: AuthUser): number => {
  const userId = Number(user?.id)
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new ProctoringReviewPolicyError('未授权', 'AUTH_UNAUTHORIZED', 401)
  }
  return userId
}

const roleCodes = (user: ReviewAuthUser): Set<string> => {
  const codes = new Set<string>()
  if (user.role) codes.add(String(user.role).toLowerCase())
  for (const role of user.roles || []) {
    const code = typeof role === 'string' ? role : role?.code
    if (code) codes.add(String(code).toLowerCase())
  }
  if (
    user.is_admin ||
    user.is_super_admin ||
    user.isAdmin ||
    user.isSuperAdmin ||
    user.role_ids?.some(id => id === 1 || id === 2)
  ) {
    codes.add('admin')
  }
  return codes
}

const actorRegion = (user: ReviewAuthUser): 'cn' | 'global' => {
  const region = String(user.dataRegion || '').trim().toUpperCase()
  if (region === 'CN') return 'cn'
  if (region === 'GLOBAL') return 'global'
  return notFound()
}

const requireStaffActor = (user?: AuthUser): ReviewActor => {
  const userId = requireUserId(user)
  const expanded = user as ReviewAuthUser
  const codes = roleCodes(expanded)
  const dataRegion = actorRegion(expanded)
  if (codes.has('admin') || codes.has('super_admin') || codes.has('superadmin')) {
    return { userId, role: 'admin', dataRegion }
  }
  if (codes.has('teacher')) {
    return { userId, role: 'teacher', dataRegion, createdByUserId: userId }
  }
  return notFound()
}

const normalizePage = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

const STAFF_ACTIONS = new Set<StaffReviewAction>([
  'request_information',
  'clear',
  'confirm_violation',
  'resolve_appeal_upheld',
  'resolve_appeal_rejected',
])

const normalizeStaffAction = (value: unknown): StaffReviewAction => {
  const action = String(value ?? '').trim() as StaffReviewAction
  if (!STAFF_ACTIONS.has(action)) {
    throw new ProctoringReviewPolicyError('复核操作无效', 'PROCTORING_REVIEW_ACTION_INVALID')
  }
  return action
}

const normalizeExpectedVersion = (value: unknown): number => {
  const version = Number(value)
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ProctoringReviewPolicyError('案件版本无效', 'PROCTORING_REVIEW_VERSION_INVALID')
  }
  return version
}

const projectionOf = (detail: {
  status: ReviewCaseStatus
  outcome: ReviewOutcome
  version: number
  firstDecidedAt: string | null
  appealDeadlineAt: string | null
  closedAt: string | null
  updatedAt: string
}) => ({
  status: detail.status,
  outcome: detail.outcome,
  version: detail.version,
  firstDecidedAt: detail.firstDecidedAt,
  appealDeadlineAt: detail.appealDeadlineAt,
  closedAt: detail.closedAt,
  updatedAt: detail.updatedAt,
})

const candidateViewOf = (detail: ReviewCaseDetail): CandidateReviewCaseDetail => {
  const item: CandidateReviewCaseListItem = {
    caseId: detail.caseId,
    examId: detail.examId,
    taskId: detail.taskId,
    attemptId: detail.attemptId,
    examTitle: detail.examTitle,
    status: detail.status,
    outcome: detail.outcome,
    triggerReasonCode: detail.triggerReasonCode,
    version: detail.version,
    openedAt: detail.openedAt,
    firstDecidedAt: detail.firstDecidedAt,
    appealDeadlineAt: detail.appealDeadlineAt,
    closedAt: detail.closedAt,
    updatedAt: detail.updatedAt,
  }
  return {
    ...item,
    decisions: detail.decisions.map(decision => ({
      action: decision.action,
      reasonCode: decision.reasonCode,
      createdAt: decision.createdAt,
    })),
    messages: detail.messages.map(message => ({
      messageId: message.messageId,
      messageType: message.messageType,
      replyToMessageId: message.replyToMessageId,
      body: message.body,
      createdAt: message.createdAt,
    })),
    appeal: detail.appeal
      ? {
          appealId: detail.appeal.appealId,
          reasonCode: detail.appeal.reasonCode,
          statement: detail.appeal.statement,
          status: detail.appeal.status,
          submittedAt: detail.appeal.submittedAt,
          resolvedAt: detail.appeal.resolvedAt,
        }
      : null,
  }
}

type ReviewAuditEvent = {
  type: 'audit'
  status: 'success'
  userId: number
  action: string
  message: string
  resourceType: 'exam'
  resourceId: number
  details: Record<string, unknown>
}

type ReviewAuditWriter = (event: ReviewAuditEvent, req?: Request) => Promise<void>

const defaultAuditWriter: ReviewAuditWriter = async (event, req) => {
  const { LogService } = await import('@/modules/logs/services/log.service')
  await LogService.log(event, req)
}

export type StaffDecisionCommand = {
  decisionId?: unknown
  action?: unknown
  reasonCode?: unknown
  comment?: unknown
  expectedVersion?: unknown
  messageId?: unknown
  informationRequest?: unknown
}

export type CandidateResponseCommand = {
  messageId?: unknown
  replyToMessageId?: unknown
  body?: unknown
  expectedVersion?: unknown
}

export type AppealCommand = {
  appealId?: unknown
  reasonCode?: unknown
  statement?: unknown
  expectedVersion?: unknown
}

export type ProctoringReviewServiceOptions = {
  now?: () => Date
  audit?: ReviewAuditWriter
}

export class ProctoringReviewService {
  private readonly now: () => Date
  private readonly audit: ReviewAuditWriter

  constructor(
    private readonly repository: ProctoringReviewRepositoryContract,
    options: ProctoringReviewServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.audit = options.audit ?? defaultAuditWriter
  }

  private async findReplay(kind: ReviewIdempotencyKind, requestId: string, requestDigest: string) {
    const stored = await this.repository.findStoredWrite(kind, requestId)
    if (!stored) return null
    if (stored.requestDigest !== requestDigest) {
      throw new ProctoringReviewPolicyError(
        '相同操作编号不能用于不同请求内容',
        'PROCTORING_REVIEW_IDEMPOTENCY_CONFLICT',
        409,
      )
    }
    return { ...stored.result, replayed: true }
  }

  async listStaffCases(
    user: AuthUser | undefined,
    query: Partial<Omit<StaffCaseQuery, 'actor'>> = {},
  ): Promise<ReviewCasePage> {
    const actor = requireStaffActor(user)
    return this.repository.listStaffCases({
      actor,
      status: query.status as ReviewCaseStatus | undefined,
      outcome: query.outcome as ReviewOutcome | undefined,
      examId: query.examId ? Number(query.examId) : undefined,
      reasonCode: query.reasonCode ? String(query.reasonCode).trim() : undefined,
      page: normalizePage(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
      limit: normalizePage(query.limit, 20, 1, 100),
    })
  }

  async getStaffCase(user: AuthUser | undefined, caseIdValue: unknown): Promise<ReviewCaseDetail> {
    const caseId = normalizeReviewUuid(caseIdValue, '案件编号')
    const detail = await this.repository.findCaseForStaff(caseId, requireStaffActor(user))
    return detail ?? notFound()
  }

  async listMyCases(
    user: AuthUser | undefined,
    query: { attemptId?: unknown; page?: unknown; limit?: unknown } = {},
  ) {
    const userId = requireUserId(user)
    return this.repository.listCandidateCases({
      userId,
      attemptId: query.attemptId == null || String(query.attemptId).trim() === ''
        ? undefined
        : normalizeReviewUuid(query.attemptId, '作答编号'),
      page: normalizePage(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
      limit: normalizePage(query.limit, 20, 1, 100),
    })
  }

  async getMyCase(user: AuthUser | undefined, caseIdValue: unknown): Promise<CandidateReviewCaseDetail> {
    const userId = requireUserId(user)
    const caseId = normalizeReviewUuid(caseIdValue, '案件编号')
    const detail = await this.repository.findCaseForCandidate(caseId, userId)
    return detail ? candidateViewOf(detail) : notFound()
  }

  async decideCase(
    user: AuthUser | undefined,
    caseIdValue: unknown,
    input: StaffDecisionCommand,
    req?: Request,
  ): Promise<ReviewWriteResult> {
    const actor = requireStaffActor(user)
    const caseId = normalizeReviewUuid(caseIdValue, '案件编号')
    const decisionId = normalizeReviewUuid(input?.decisionId, '决定编号')
    const action = normalizeStaffAction(input?.action)
    const reasonCode: ReviewReasonCode = validateDecisionReason(action, input?.reasonCode)
    const comment = normalizeReviewText(input?.comment)
    const expectedVersion = normalizeExpectedVersion(input?.expectedVersion)
    const messageId = action === 'request_information'
      ? normalizeReviewUuid(input?.messageId, '信息请求编号')
      : undefined
    const informationRequest = action === 'request_information'
      ? normalizeReviewText(input?.informationRequest)
      : undefined
    const normalizedRequest = {
      caseId,
      decisionId,
      action,
      reasonCode,
      comment,
      expectedVersion,
      ...(messageId ? { messageId, informationRequest } : {}),
    }
    const requestDigest = reviewRequestDigest(normalizedRequest)

    const detail = await this.repository.findCaseForStaff(caseId, actor)
    if (!detail) return notFound()
    const decisionReplay = await this.findReplay('decision', decisionId, requestDigest)
    if (decisionReplay) return decisionReplay
    if (messageId) {
      const messageReplay = await this.findReplay('message', messageId, requestDigest)
      if (messageReplay) return messageReplay
    }

    const nextCase = transitionReviewCase(
      projectionOf(detail),
      { action: action as ReviewAction, expectedVersion },
      this.now(),
    )
    const result = await this.repository.applyDecision({
      actor,
      caseId,
      decisionId,
      action,
      reasonCode,
      comment,
      expectedVersion,
      requestDigest,
      messageId,
      informationRequest,
      nextCase,
    })
    await this.audit(
      {
        type: 'audit',
        status: 'success',
        userId: actor.userId,
        action: '严格监考人工复核',
        message: '考务人员完成复核案件操作',
        resourceType: 'exam',
        resourceId: detail.examId,
        details: { caseId, decisionId, action, reasonCode, version: nextCase.version },
      },
      req,
    )
    return result
  }

  async respondToInformationRequest(
    user: AuthUser | undefined,
    caseIdValue: unknown,
    input: CandidateResponseCommand,
    req?: Request,
  ) {
    const userId = requireUserId(user)
    const caseId = normalizeReviewUuid(caseIdValue, '案件编号')
    const messageId = normalizeReviewUuid(input?.messageId, '回复编号')
    const replyToMessageId = normalizeReviewUuid(input?.replyToMessageId, '信息请求编号')
    const body = normalizeReviewText(input?.body)
    const expectedVersion = normalizeExpectedVersion(input?.expectedVersion)
    const normalizedRequest = { caseId, messageId, replyToMessageId, body, expectedVersion }
    const requestDigest = reviewRequestDigest(normalizedRequest)

    const detail = await this.repository.findCaseForCandidate(caseId, userId)
    if (!detail) return notFound()
    const replay = await this.findReplay('message', messageId, requestDigest)
    if (replay) return { case: candidateViewOf(replay.case), replayed: true }

    const nextCase = transitionReviewCase(
      projectionOf(detail),
      { action: 'candidate_response', expectedVersion },
      this.now(),
    )
    const result = await this.repository.addCandidateResponse({
      userId,
      caseId,
      messageId,
      replyToMessageId,
      body,
      expectedVersion,
      requestDigest,
      nextCase,
    })
    await this.audit(
      {
        type: 'audit',
        status: 'success',
        userId,
        action: '提交监考复核补充说明',
        message: '考生提交复核案件补充说明',
        resourceType: 'exam',
        resourceId: detail.examId,
        details: { caseId, messageId, replyToMessageId, version: nextCase.version },
      },
      req,
    )
    return { case: candidateViewOf(result.case), replayed: false }
  }

  async submitAppeal(
    user: AuthUser | undefined,
    caseIdValue: unknown,
    input: AppealCommand,
    req?: Request,
  ) {
    const userId = requireUserId(user)
    const caseId = normalizeReviewUuid(caseIdValue, '案件编号')
    const appealId = normalizeReviewUuid(input?.appealId, '申诉编号')
    const reasonCode: AppealReasonCode = normalizeAppealReasonCode(input?.reasonCode)
    const statement = normalizeReviewText(input?.statement)
    const expectedVersion = normalizeExpectedVersion(input?.expectedVersion)
    const normalizedRequest = { caseId, appealId, reasonCode, statement, expectedVersion }
    const requestDigest = reviewRequestDigest(normalizedRequest)

    const detail = await this.repository.findCaseForCandidate(caseId, userId)
    if (!detail) return notFound()
    const replay = await this.findReplay('appeal', appealId, requestDigest)
    if (replay) return { case: candidateViewOf(replay.case), replayed: true }

    const nextCase = transitionReviewCase(
      projectionOf(detail),
      { action: 'submit_appeal', expectedVersion },
      this.now(),
    )
    const result = await this.repository.addAppeal({
      userId,
      caseId,
      appealId,
      reasonCode,
      statement,
      expectedVersion,
      requestDigest,
      nextCase,
    })
    await this.audit(
      {
        type: 'audit',
        status: 'success',
        userId,
        action: '提交严格监考申诉',
        message: '考生提交复核案件申诉',
        resourceType: 'exam',
        resourceId: detail.examId,
        details: { caseId, appealId, reasonCode, version: nextCase.version },
      },
      req,
    )
    return { case: candidateViewOf(result.case), replayed: false }
  }

  async exportCaseCsv(user: AuthUser | undefined, caseIdValue: unknown, req?: Request) {
    const actor = requireStaffActor(user)
    const caseId = normalizeReviewUuid(caseIdValue, '案件编号')
    const detail = await this.repository.findCaseForStaff(caseId, actor)
    if (!detail) return notFound()
    const csv = buildReviewCaseCsv(detail)
    await this.audit(
      {
        type: 'audit',
        status: 'success',
        userId: actor.userId,
        action: '导出严格监考复核案件',
        message: '考务人员导出复核案件审计时间线',
        resourceType: 'exam',
        resourceId: detail.examId,
        details: { caseId, version: detail.version },
      },
      req,
    )
    return {
      csv,
      filenameAscii: `wenheng-review-case-${caseId}.csv`,
      filenameUtf8: `问衡监考复核_${caseId}.csv`,
    }
  }
}
