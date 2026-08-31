import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthUser } from '@/types/auth'
import type {
  ProctoringAttemptContext,
  ProctoringIdentityCheck,
  ProctoringSession,
  StoredProctoringEvent,
} from '../domain/proctoring.model.js'
import { normalizeProctoringPolicy, type NormalizedFactualEvent } from '../domain/proctoring.policy.js'
import { ProctoringService } from './proctoring.service.js'

const NOW = new Date('2026-08-30T10:00:00.000Z')
const SESSION_ID = '7cb06150-6f56-45c5-92a1-32163aa6464f'
const ATTEMPT_ID = '81c75367-fb18-42f4-8b97-b8f5c36f8a0c'
const CONSENT_ID = '0d76b499-7c51-4991-b1b8-54fb418d2c31'

const candidate: AuthUser = {
  id: 71,
  username: 'candidate-71',
  email: 'candidate-71@example.test',
  role: 'student',
  dataRegion: 'CN',
}

const sessionFor = (state: ProctoringSession['state']): ProctoringSession => ({
  sessionId: SESSION_ID,
  consentId: CONSENT_ID,
  attemptId: ATTEMPT_ID,
  examId: 12,
  taskId: 30,
  userId: 71,
  dataRegion: 'cn',
  state,
  lastSequence: 0,
  cameraRequired: true,
  microphoneRequired: true,
  identityRequired: true,
  identityStatus: state === 'prepared' ? 'pending' : 'passed',
  startedAt: state === 'prepared' ? null : '2026-08-30T09:00:00.000Z',
  lastHeartbeatAt: state === 'prepared' ? null : '2026-08-30T09:50:00.000Z',
  interruptionStartedAt: state === 'interrupted' ? '2026-08-30T09:50:00.000Z' : null,
  completedAt: null,
  reviewReasonCode: null,
})

class ReviewCaseCreationRepository {
  readonly reviewCases = new Map<string, { caseId: string; reasonCode: string }>()
  session: ProctoringSession

  constructor(state: ProctoringSession['state']) {
    this.session = sessionFor(state)
  }

  private ensureReviewCase(input: { reviewCaseId?: string | null; reasonCode?: string | null }) {
    if (!input.reviewCaseId || !input.reasonCode) return
    if (!this.reviewCases.has(this.session.sessionId)) {
      this.reviewCases.set(this.session.sessionId, { caseId: input.reviewCaseId, reasonCode: input.reasonCode })
    }
  }

  async findSessionById(sessionId: string, userId: number) {
    return sessionId === this.session.sessionId && userId === this.session.userId ? structuredClone(this.session) : null
  }

  async getAttemptContext(): Promise<ProctoringAttemptContext> {
    return {
      attemptId: ATTEMPT_ID,
      examId: 12,
      taskId: 30,
      userId: 71,
      resultStatus: 'in_progress',
      dataRegion: 'cn',
      ageBand: 'ADULT',
      policy: normalizeProctoringPolicy({ level: 'strict', interruptionGraceSeconds: 45 }),
      allowMinors: true,
      examEndsAt: '2026-08-30T12:00:00.000Z',
    }
  }

  async recordEvent(input: {
    event: NormalizedFactualEvent
    nextState: ProctoringSession['state']
    reviewReasonCode?: string | null
    reviewCaseId?: string | null
  }) {
    this.session.state = input.nextState
    this.session.lastSequence = input.event.sequence
    this.session.reviewReasonCode = input.reviewReasonCode || this.session.reviewReasonCode
    if (input.nextState === 'review_required') {
      this.ensureReviewCase({ reviewCaseId: input.reviewCaseId, reasonCode: this.session.reviewReasonCode })
    }
    const event: StoredProctoringEvent = {
      eventId: input.event.eventId,
      sessionId: this.session.sessionId,
      examId: this.session.examId,
      userId: this.session.userId,
      sequence: input.event.sequence,
      type: input.event.type,
      severity: input.event.severity,
      state: input.event.state,
      occurredAt: input.event.occurredAt,
      receivedAt: NOW.toISOString(),
    }
    return { session: structuredClone(this.session), event, replayed: false }
  }

  async heartbeat(input: {
    state: ProctoringSession['state']
    reviewReasonCode: string | null
    reviewCaseId?: string | null
  }) {
    this.session.state = input.state
    this.session.reviewReasonCode = input.reviewReasonCode
    if (input.state === 'review_required') {
      this.ensureReviewCase({ reviewCaseId: input.reviewCaseId, reasonCode: input.reviewReasonCode })
    }
    return structuredClone(this.session)
  }

  async insertIdentityCheck(input: {
    check: ProctoringIdentityCheck
    reviewCaseId?: string | null
  }) {
    this.session.identityStatus = input.check.result
    if (input.check.result === 'failed') {
      this.session.state = 'review_required'
      this.session.reviewReasonCode = input.check.reasonCode || 'IDENTITY_VERIFICATION_FAILED'
      this.ensureReviewCase({ reviewCaseId: input.reviewCaseId, reasonCode: this.session.reviewReasonCode })
    }
    return structuredClone(this.session)
  }
}

const serviceFor = (repository: ReviewCaseCreationRepository) =>
  new ProctoringService(repository as any, {
    now: () => NOW,
    audit: async () => undefined,
    identityVerifier: async () => ({
      checkId: '8852ce70-6c26-4f8e-a8cb-e64df3c5a1ac',
      result: 'failed',
      reasonCode: 'FACE_NOT_MATCHED',
      similarity: 0.42,
      livenessPassed: true,
      model: 'test-face-v1',
    }),
  })

test('严重事实事件进入人工复核时幂等创建一个案件', async () => {
  const repository = new ReviewCaseCreationRepository('active')
  const service = serviceFor(repository)
  await service.recordFactualEvent(candidate, SESSION_ID, {
    eventId: 'b95120f9-20ce-4f55-824e-20729b9f59c6',
    type: 'multiple_faces',
    sequence: 1,
    occurredAt: NOW.toISOString(),
    state: { faceCount: 2, camera: 'available' },
  })
  await service.recordFactualEvent(candidate, SESSION_ID, {
    eventId: '40533d9b-951e-4a04-bc12-96c4720fa2c5',
    type: 'multiple_faces',
    sequence: 2,
    occurredAt: NOW.toISOString(),
    state: { faceCount: 2, camera: 'available' },
  })
  assert.equal(repository.reviewCases.size, 1)
  assert.equal(repository.reviewCases.get(SESSION_ID)?.reasonCode, 'MULTIPLE_FACES')
})

test('心跳或传感器持续超时进入人工复核时创建一个案件', async () => {
  const repository = new ReviewCaseCreationRepository('interrupted')
  const service = serviceFor(repository)
  await service.heartbeat(candidate, SESSION_ID, {
    camera: 'interrupted',
    microphone: 'available',
    app: 'foreground',
    network: 'online',
  })
  await service.heartbeat(candidate, SESSION_ID, {
    camera: 'interrupted',
    microphone: 'available',
    app: 'foreground',
    network: 'online',
  })
  assert.equal(repository.reviewCases.size, 1)
  assert.match(repository.reviewCases.get(SESSION_ID)?.reasonCode || '', /TIMEOUT/)
})

test('身份核验失败进入人工复核时创建一个案件且重复调用不重复创建', async () => {
  const repository = new ReviewCaseCreationRepository('prepared')
  const service = serviceFor(repository)
  const images = ['data:image/jpeg;base64,dGVzdA==']
  await service.verifyIdentity(candidate, SESSION_ID, { images })
  await assert.rejects(service.verifyIdentity(candidate, SESSION_ID, { images }))
  assert.equal(repository.reviewCases.size, 1)
  assert.equal(repository.reviewCases.get(SESSION_ID)?.reasonCode, 'FACE_NOT_MATCHED')
})
