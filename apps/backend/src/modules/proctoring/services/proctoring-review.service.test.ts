import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthUser } from '@/types/auth'
import type {
  AddAppealInput,
  AddCandidateResponseInput,
  ApplyDecisionInput,
  CandidateCaseQuery,
  CandidateReviewCaseDetail,
  ProctoringReviewRepositoryContract,
  ReviewActor,
  ReviewCaseDetail,
  ReviewCasePage,
  ReviewIdempotencyKind,
  ReviewStoredWrite,
  ReviewWriteResult,
  StaffCaseQuery,
} from '../domain/proctoring-review.model.js'
import { ProctoringReviewPolicyError, type ReviewCaseProjection } from '../domain/proctoring-review.policy.js'
import { ProctoringReviewService } from './proctoring-review.service.js'

const CASE_ID = '7395c0a5-90c2-4db2-a7f1-eccf6327945d'
const SESSION_ID = '7cb06150-6f56-45c5-92a1-32163aa6464f'
const ATTEMPT_ID = '81c75367-fb18-42f4-8b97-b8f5c36f8a0c'

const baseCase = (): ReviewCaseDetail => ({
  caseId: CASE_ID,
  sessionId: SESSION_ID,
  examId: 12,
  taskId: 30,
  attemptId: ATTEMPT_ID,
  userId: 71,
  candidatePublicId: 'WH-CANDIDATE-71',
  candidateDisplayName: '考生 71',
  examTitle: '问衡产品能力测评',
  dataRegion: 'cn',
  status: 'pending_review',
  outcome: 'pending',
  triggerReasonCode: 'IDENTITY_VERIFICATION_FAILED',
  version: 1,
  openedAt: '2026-08-30T09:00:00.000Z',
  firstDecidedAt: null,
  appealDeadlineAt: null,
  closedAt: null,
  retainUntil: '2027-02-26T09:00:00.000Z',
  updatedAt: '2026-08-30T09:00:00.000Z',
  session: {
    state: 'review_required',
    identityStatus: 'failed',
    startedAt: '2026-08-30T08:30:00.000Z',
    lastHeartbeatAt: '2026-08-30T08:59:00.000Z',
    interruptionStartedAt: null,
    completedAt: null,
  },
  identityChecks: [
    {
      checkId: 'f0cd0d31-95bf-48af-b9a3-d0762a91e9b1',
      result: 'failed',
      reasonCode: 'FACE_MISMATCH',
      similarity: 0.42,
      livenessPassed: true,
      model: 'server-face-v1',
      checkedAt: '2026-08-30T08:55:00.000Z',
    },
  ],
  events: [
    {
      eventId: '98d0f916-c225-4c83-81a7-7d030f6b10ef',
      sequence: 1,
      type: 'identity_verification_failed',
      severity: 'critical',
      state: { camera: 'available', faceCount: 1 },
      occurredAt: '2026-08-30T08:55:00.000Z',
      receivedAt: '2026-08-30T08:55:01.000Z',
    },
  ],
  decisions: [],
  messages: [],
  appeal: null,
})

const toCandidateDetail = (detail: ReviewCaseDetail): CandidateReviewCaseDetail => ({
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
  decisions: detail.decisions.map(item => ({
    action: item.action,
    reasonCode: item.reasonCode,
    createdAt: item.createdAt,
  })),
  messages: detail.messages.map(item => ({
    messageId: item.messageId,
    messageType: item.messageType,
    replyToMessageId: item.replyToMessageId,
    body: item.body,
    createdAt: item.createdAt,
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
})

class MemoryReviewRepository implements ProctoringReviewRepositoryContract {
  detail = baseCase()
  private readonly storedWrites = new Map<string, ReviewStoredWrite>()
  private readonly examCreatedBy: number
  private examScore = 88
  private accountStatus = 'active'

  constructor(options: { examCreatedBy?: number } = {}) {
    this.examCreatedBy = options.examCreatedBy ?? 11
  }

  private staffCanRead(actor: ReviewActor) {
    return actor.dataRegion === this.detail.dataRegion &&
      (actor.role === 'admin' || actor.createdByUserId === this.examCreatedBy)
  }

  async listStaffCases(input: StaffCaseQuery): Promise<ReviewCasePage> {
    const items = this.staffCanRead(input.actor) ? [structuredClone(this.detail)] : []
    return { items, total: items.length, page: input.page, limit: input.limit }
  }

  async listCandidateCases(input: CandidateCaseQuery) {
    const matchesAttempt = !input.attemptId || input.attemptId === this.detail.attemptId
    const items = input.userId === this.detail.userId && matchesAttempt ? [toCandidateDetail(this.detail)] : []
    return { items, total: items.length, page: input.page, limit: input.limit }
  }

  async findCaseForStaff(caseId: string, actor: ReviewActor) {
    return caseId === this.detail.caseId && this.staffCanRead(actor) ? structuredClone(this.detail) : null
  }

  async findCaseForCandidate(caseId: string, userId: number) {
    return caseId === this.detail.caseId && userId === this.detail.userId ? structuredClone(this.detail) : null
  }

  async findStoredWrite(_kind: ReviewIdempotencyKind, _requestId: string): Promise<ReviewStoredWrite | null> {
    const stored = this.storedWrites.get(`${_kind}:${_requestId}`)
    return stored ? structuredClone(stored) : null
  }

  private applyProjection(next: ReviewCaseProjection) {
    Object.assign(this.detail, structuredClone(next))
  }

  private result(): ReviewWriteResult {
    return { case: structuredClone(this.detail), replayed: false }
  }

  private store(kind: ReviewIdempotencyKind, requestId: string, requestDigest: string, result: ReviewWriteResult) {
    this.storedWrites.set(`${kind}:${requestId}`, {
      kind,
      requestId,
      requestDigest,
      result: structuredClone(result),
    })
  }

  async applyDecision(input: ApplyDecisionInput): Promise<ReviewWriteResult> {
    if (!this.staffCanRead(input.actor)) {
      throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
    }
    if (this.detail.version !== input.expectedVersion) {
      throw new ProctoringReviewPolicyError('案件已被其他考务人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
    }
    const versionBefore = this.detail.version
    this.applyProjection(input.nextCase)
    this.detail.decisions.push({
      decisionId: input.decisionId,
      actorUserId: input.actor.userId,
      action: input.action,
      reasonCode: input.reasonCode,
      comment: input.comment,
      caseVersionBefore: versionBefore,
      caseVersionAfter: input.nextCase.version,
      createdAt: input.nextCase.updatedAt,
    })
    if (input.action === 'request_information' && input.messageId && input.informationRequest) {
      this.detail.messages.push({
        messageId: input.messageId,
        actorUserId: input.actor.userId,
        messageType: 'information_request',
        replyToMessageId: null,
        body: input.informationRequest,
        caseVersionBefore: versionBefore,
        caseVersionAfter: input.nextCase.version,
        createdAt: input.nextCase.updatedAt,
      })
    }
    if (input.action === 'resolve_appeal_upheld' && this.detail.appeal) {
      this.detail.appeal.status = 'upheld'
      this.detail.appeal.resolutionDecisionId = input.decisionId
      this.detail.appeal.resolvedAt = input.nextCase.updatedAt
    }
    if (input.action === 'resolve_appeal_rejected' && this.detail.appeal) {
      this.detail.appeal.status = 'rejected'
      this.detail.appeal.resolutionDecisionId = input.decisionId
      this.detail.appeal.resolvedAt = input.nextCase.updatedAt
    }
    const result = this.result()
    this.store('decision', input.decisionId, input.requestDigest, result)
    if (input.messageId) this.store('message', input.messageId, input.requestDigest, result)
    return result
  }

  async addCandidateResponse(input: AddCandidateResponseInput): Promise<ReviewWriteResult> {
    if (input.userId !== this.detail.userId) {
      throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
    }
    if (this.detail.version !== input.expectedVersion) {
      throw new ProctoringReviewPolicyError('案件已被其他人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
    }
    const request = this.detail.messages.find(
      message => message.messageId === input.replyToMessageId && message.messageType === 'information_request',
    )
    const alreadyReplied = this.detail.messages.some(
      message => message.messageType === 'candidate_response' && message.replyToMessageId === input.replyToMessageId,
    )
    if (!request || alreadyReplied) {
      throw new ProctoringReviewPolicyError('补充信息请求不存在或已经回复', 'PROCTORING_REVIEW_RESPONSE_CONFLICT', 409)
    }
    const versionBefore = this.detail.version
    this.applyProjection(input.nextCase)
    this.detail.messages.push({
      messageId: input.messageId,
      actorUserId: input.userId,
      messageType: 'candidate_response',
      replyToMessageId: input.replyToMessageId,
      body: input.body,
      caseVersionBefore: versionBefore,
      caseVersionAfter: input.nextCase.version,
      createdAt: input.nextCase.updatedAt,
    })
    const result = this.result()
    this.store('message', input.messageId, input.requestDigest, result)
    return result
  }

  async addAppeal(input: AddAppealInput): Promise<ReviewWriteResult> {
    if (input.userId !== this.detail.userId) {
      throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
    }
    if (this.detail.version !== input.expectedVersion) {
      throw new ProctoringReviewPolicyError('案件已被其他人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
    }
    if (this.detail.appeal) {
      throw new ProctoringReviewPolicyError('本案件已经提交过申诉', 'PROCTORING_REVIEW_APPEAL_ALREADY_SUBMITTED', 409)
    }
    this.applyProjection(input.nextCase)
    this.detail.appeal = {
      appealId: input.appealId,
      userId: input.userId,
      reasonCode: input.reasonCode,
      statement: input.statement,
      status: 'pending',
      resolutionDecisionId: null,
      submittedAt: input.nextCase.updatedAt,
      resolvedAt: null,
    }
    const result = this.result()
    this.store('appeal', input.appealId, input.requestDigest, result)
    return result
  }

  readExamScore() {
    return this.examScore
  }

  readAccountStatus() {
    return this.accountStatus
  }
}

const authUser = (id: number, role: 'admin' | 'teacher' | 'student', dataRegion: 'CN' | 'GLOBAL' = 'CN') =>
  ({ id, username: `user-${id}`, email: `${id}@example.test`, role, dataRegion }) satisfies AuthUser

const isHttpStatus = (status: number) => (error: unknown) =>
  typeof error === 'object' && error !== null && Number((error as { status?: number }).status) === status

const isPolicyCode = (code: string) => (error: unknown) =>
  error instanceof ProctoringReviewPolicyError && error.code === code

const serviceFor = (repository: MemoryReviewRepository, readNow = () => new Date('2026-08-30T10:00:00.000Z')) =>
  new ProctoringReviewService(repository, { now: readNow, audit: async () => undefined })

test('同一区域管理员可以读取案件，跨区域管理员对外看到不存在', async () => {
  const service = new ProctoringReviewService(new MemoryReviewRepository())
  const detail = await service.getStaffCase(authUser(1, 'admin'), CASE_ID)
  assert.equal(detail.caseId, CASE_ID)
  await assert.rejects(service.getStaffCase(authUser(2, 'admin', 'GLOBAL'), CASE_ID), isHttpStatus(404))
})

test('教师只能读取自己创建考试的复核案件', async () => {
  const service = new ProctoringReviewService(new MemoryReviewRepository({ examCreatedBy: 11 }))
  assert.equal((await service.getStaffCase(authUser(11, 'teacher'), CASE_ID)).examId, 12)
  await assert.rejects(service.getStaffCase(authUser(22, 'teacher'), CASE_ID), isHttpStatus(404))
})

test('案件本人可以读取考生视图，其他学生与不存在案件均返回 404', async () => {
  const repository = new MemoryReviewRepository()
  repository.detail.decisions = [{
    decisionId: '98d0f916-c225-4c83-81a7-7d030f6b10ef',
    actorUserId: 11,
    action: 'request_information',
    reasonCode: 'CANDIDATE_EXPLANATION_REQUIRED',
    comment: '考务内部判断备注',
    caseVersionBefore: 1,
    caseVersionAfter: 2,
    createdAt: '2026-08-30T09:30:00.000Z',
  }]
  repository.detail.messages = [{
    messageId: 'f0cd0d31-95bf-48af-b9a3-d0762a91e9b1',
    actorUserId: 11,
    messageType: 'information_request',
    replyToMessageId: null,
    body: '请说明设备中断情况。',
    caseVersionBefore: 1,
    caseVersionAfter: 2,
    createdAt: '2026-08-30T09:30:00.000Z',
  }]
  const service = new ProctoringReviewService(repository)
  const own = await service.getMyCase(authUser(71, 'student'), CASE_ID)
  assert.equal(own.caseId, CASE_ID)
  assert.equal('events' in own, false)
  assert.equal('candidatePublicId' in own, false)
  assert.equal('actorUserId' in own.decisions[0]!, false)
  assert.equal('comment' in own.decisions[0]!, false)
  assert.equal('caseVersionBefore' in own.decisions[0]!, false)
  assert.equal('actorUserId' in own.messages[0]!, false)
  assert.equal('caseVersionAfter' in own.messages[0]!, false)

  await assert.rejects(service.getMyCase(authUser(72, 'student'), CASE_ID), isHttpStatus(404))
  await assert.rejects(
    service.getMyCase(authUser(71, 'student'), '2bd6dfd8-62b2-4d90-ad04-2273d187dc46'),
    isHttpStatus(404),
  )
})

test('考生成绩页按作答编号精确筛选复核案件', async () => {
  const repository = new MemoryReviewRepository()
  const service = serviceFor(repository)

  const matched = await service.listMyCases(authUser(71, 'student'), { attemptId: ATTEMPT_ID })
  assert.equal(matched.total, 1)
  assert.equal(matched.items[0]?.attemptId, ATTEMPT_ID)

  const unmatched = await service.listMyCases(authUser(71, 'student'), {
    attemptId: '3ac57fc6-4f1f-4c14-87f4-e7ed42cd0e90',
  })
  assert.equal(unmatched.total, 0)

  await assert.rejects(
    service.listMyCases(authUser(71, 'student'), { attemptId: 'not-an-attempt-id' }),
    (error: any) => error?.code === 'PROCTORING_REVIEW_UUID_INVALID',
  )
})

test('学生不能通过考务详情入口探测案件', async () => {
  const service = new ProctoringReviewService(new MemoryReviewRepository())
  await assert.rejects(service.getStaffCase(authUser(71, 'student'), CASE_ID), isHttpStatus(404))
})

test('相同决定编号和同一语义内容幂等重放，不同内容产生冲突', async () => {
  const repository = new MemoryReviewRepository()
  const service = serviceFor(repository)
  const command = {
    decisionId: 'f4ef8d69-daf4-4bc5-b384-9c5338a31db5',
    action: 'confirm_violation' as const,
    reasonCode: 'IDENTITY_MISMATCH_CONFIRMED',
    comment: '人工比对后确认身份不一致',
    expectedVersion: 1,
  }

  const first = await service.decideCase(authUser(11, 'teacher'), CASE_ID, command)
  const replay = await service.decideCase(authUser(11, 'teacher'), CASE_ID, command)
  assert.equal(first.replayed, false)
  assert.equal(replay.replayed, true)
  assert.equal(replay.case.version, 2)
  assert.equal(repository.detail.decisions.length, 1)

  await assert.rejects(
    service.decideCase(authUser(11, 'teacher'), CASE_ID, { ...command, comment: '换一段内容' }),
    isPolicyCode('PROCTORING_REVIEW_IDEMPOTENCY_CONFLICT'),
  )
})

test('新写操作携带旧 expectedVersion 时拒绝覆盖已有状态', async () => {
  const repository = new MemoryReviewRepository()
  const service = serviceFor(repository)
  await service.decideCase(authUser(11, 'teacher'), CASE_ID, {
    decisionId: 'a7bfbb13-7772-4782-884f-4c559e8b7396',
    action: 'confirm_violation',
    reasonCode: 'IDENTITY_MISMATCH_CONFIRMED',
    comment: '人工确认身份不一致',
    expectedVersion: 1,
  })
  await assert.rejects(
    service.decideCase(authUser(11, 'teacher'), CASE_ID, {
      decisionId: '7a1692c1-b666-40e5-8bd8-210087db44b1',
      action: 'clear',
      reasonCode: 'INSUFFICIENT_EVIDENCE',
      comment: '证据不足，排除异常',
      expectedVersion: 1,
    }),
    isPolicyCode('PROCTORING_REVIEW_VERSION_CONFLICT'),
  )
})

test('请求补充同时写入决定和消息，同一请求只接受一次考生回复', async () => {
  const repository = new MemoryReviewRepository()
  const service = serviceFor(repository)
  const decision = await service.decideCase(authUser(11, 'teacher'), CASE_ID, {
    decisionId: '35e99351-40c5-4bcf-b030-665b15e9ed7f',
    messageId: '747b4fc9-de33-4a4f-824e-40081204271c',
    action: 'request_information',
    reasonCode: 'CANDIDATE_EXPLANATION_REQUIRED',
    comment: '需要说明摄像头中断原因',
    informationRequest: '请说明 08:55 摄像头中断的设备情况。',
    expectedVersion: 1,
  })
  assert.equal(decision.case.status, 'information_requested')
  assert.equal(decision.case.decisions.length, 1)
  assert.equal(decision.case.messages[0]?.messageType, 'information_request')

  const responseCommand = {
    messageId: 'c9bd6b4c-e952-4c08-8c8d-06f266071340',
    replyToMessageId: '747b4fc9-de33-4a4f-824e-40081204271c',
    body: '设备系统弹出电话导致摄像头短暂停止，随后已恢复。',
    expectedVersion: 2,
  }
  const response = await service.respondToInformationRequest(authUser(71, 'student'), CASE_ID, responseCommand)
  const replay = await service.respondToInformationRequest(authUser(71, 'student'), CASE_ID, responseCommand)
  assert.equal(response.case.status, 'pending_review')
  assert.equal(replay.replayed, true)
  assert.equal(repository.detail.messages.filter(item => item.messageType === 'candidate_response').length, 1)

  await assert.rejects(
    service.respondToInformationRequest(authUser(71, 'student'), CASE_ID, {
      ...responseCommand,
      messageId: '043a72f3-d107-46ce-96ef-c8f071140b89',
      expectedVersion: 3,
    }),
    isPolicyCode('PROCTORING_REVIEW_STATE_CONFLICT'),
  )
})

test('确认违规案件只能在七天内申诉一次并可由考务处理', async () => {
  const repository = new MemoryReviewRepository()
  let now = new Date('2026-08-30T10:00:00.000Z')
  const service = serviceFor(repository, () => now)
  await service.decideCase(authUser(11, 'teacher'), CASE_ID, {
    decisionId: '89857354-1cdc-4600-8087-520376af1b47',
    action: 'confirm_violation',
    reasonCode: 'MULTIPLE_PERSONS_CONFIRMED',
    comment: '画面中持续出现多名人员',
    expectedVersion: 1,
  })

  now = new Date('2026-09-01T10:00:00.000Z')
  const appealCommand = {
    appealId: 'e7be900b-82ab-4e58-8b02-c45a440f9056',
    reasonCode: 'ENVIRONMENTAL_CAUSE',
    statement: '家人在房间门口短暂停留，并未参与答题。',
    expectedVersion: 2,
  }
  const appeal = await service.submitAppeal(authUser(71, 'student'), CASE_ID, appealCommand)
  const replay = await service.submitAppeal(authUser(71, 'student'), CASE_ID, appealCommand)
  assert.equal(appeal.case.status, 'appeal_pending')
  assert.equal(replay.replayed, true)

  await assert.rejects(
    service.submitAppeal(authUser(71, 'student'), CASE_ID, {
      ...appealCommand,
      appealId: '3104d9ec-aab1-4473-a29d-32afb8b03f22',
      expectedVersion: 3,
    }),
    isPolicyCode('PROCTORING_REVIEW_STATE_CONFLICT'),
  )

  const resolution = await service.decideCase(authUser(11, 'teacher'), CASE_ID, {
    decisionId: '5298d41c-e2a9-43e6-b1a4-dd3ffcb0c3fa',
    action: 'resolve_appeal_upheld',
    reasonCode: 'APPEAL_EVIDENCE_ACCEPTED',
    comment: '申诉说明与事件时间线一致，申诉成立。',
    expectedVersion: 3,
  })
  assert.equal(resolution.case.status, 'appeal_resolved')
  assert.equal(resolution.case.outcome, 'cleared')
  assert.equal(resolution.case.appeal?.status, 'upheld')
})

test('超过首次决定七天后提交申诉返回明确冲突', async () => {
  const repository = new MemoryReviewRepository()
  let now = new Date('2026-08-30T10:00:00.000Z')
  const service = serviceFor(repository, () => now)
  await service.decideCase(authUser(11, 'teacher'), CASE_ID, {
    decisionId: 'b69c1713-1ac9-4d4c-803a-d5e5f6734484',
    action: 'confirm_violation',
    reasonCode: 'SCREEN_CAPTURE_CONFIRMED',
    comment: '考试过程中确认存在录屏行为',
    expectedVersion: 1,
  })
  now = new Date('2026-09-06T10:00:00.001Z')
  await assert.rejects(
    service.submitAppeal(authUser(71, 'student'), CASE_ID, {
      appealId: 'a0f14f43-2f75-4d29-91dd-f9e2ba7d7d6c',
      reasonCode: 'EVENT_MISINTERPRETED',
      statement: '系统事件可能被误解。',
      expectedVersion: 2,
    }),
    isPolicyCode('PROCTORING_REVIEW_APPEAL_EXPIRED'),
  )
})

test('确认违规不会调用或改变成绩与账号状态', async () => {
  const repository = new MemoryReviewRepository()
  const service = serviceFor(repository)
  const result = await service.decideCase(authUser(11, 'teacher'), CASE_ID, {
    decisionId: '49d721ab-d7bd-47f1-99be-1fc96238a270',
    action: 'confirm_violation',
    reasonCode: 'UNRESOLVED_SENSOR_INTERRUPTION',
    comment: '多次传感器中断且未得到合理说明',
    expectedVersion: 1,
  })
  assert.equal(result.case.outcome, 'violation_confirmed')
  assert.equal(repository.readExamScore(), 88)
  assert.equal(repository.readAccountStatus(), 'active')
})
