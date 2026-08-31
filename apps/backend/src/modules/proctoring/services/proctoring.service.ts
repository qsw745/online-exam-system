import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import HttpError from '@/common/errors/http-error'
import { FACE_MATCH_THRESHOLD } from '@/config/face-engine'
import { cosineSimilarity } from '@/modules/auth/utils/vector'
import type { AuthUser } from '@/types/auth'
import { CODES } from '@/types/response'
import type {
  ProctoringIdentityCheck,
  ProctoringListResult,
  ProctoringSession,
  ProctoringSessionDecision,
  ProctoringSeverity,
} from '../domain/proctoring.model.js'
import {
  assessHeartbeat,
  assertConsentScope,
  nextSessionState,
  normalizeFactualEvent,
  proctoringPolicyDigest,
  ProctoringPolicyError,
  type ProctoringConsentScope,
  type ProctoringSessionState,
} from '../domain/proctoring.policy.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STRICT_CATEGORIES = ['camera', 'microphone_status', 'identity_verification', 'factual_events'] as const
const SERVER_ONLY_EVENTS = new Set(['identity_verification_passed', 'identity_verification_failed'])
const MAX_IDENTITY_FRAMES = 3
const MAX_IDENTITY_FRAME_CHARS = 2_000_000

const pickRole = (user?: AuthUser | null) =>
  (user as any)?.role ?? (user as any)?.roles?.[0]?.code ?? (user as any)?.roles?.[0] ?? undefined

const toSeverity = (value?: string): ProctoringSeverity => {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'critical') return 'critical'
  if (normalized === 'warn' || normalized === 'warning') return 'warn'
  return 'info'
}

const requireUserId = (user?: AuthUser): number => {
  const id = Number(user?.id)
  if (!Number.isFinite(id) || id <= 0) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
  return id
}

const requireUuid = (value: unknown, code: string, label: string): string => {
  const normalized = String(value || '').trim()
  if (!UUID_RE.test(normalized)) throw new ProctoringPolicyError(`${label}无效`, code)
  return normalized
}

const decisionFor = (session: ProctoringSession): ProctoringSessionDecision => {
  if (session.state === 'completed') return { state: session.state, mayContinue: false, action: 'completed' }
  if (session.state === 'review_required') {
    return {
      state: session.state,
      mayContinue: false,
      action: 'manual_review',
      reasonCode: session.reviewReasonCode,
    }
  }
  if (session.state === 'interrupted' || session.state === 'prepared') {
    return { state: session.state, mayContinue: false, action: 'remain_paused', reasonCode: session.reviewReasonCode }
  }
  return { state: session.state, mayContinue: true, action: 'continue' }
}

const consentScope = (input: {
  userId: number
  examId: number
  attemptId: string
  dataRegion: 'cn' | 'global'
  policyVersion: string
}): ProctoringConsentScope => ({ ...input })

const validateIdentityFrames = (images: unknown): string[] => {
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IDENTITY_FRAMES) {
    throw new ProctoringPolicyError('身份核验仅接受 1 至 3 帧有限画面', 'PROCTORING_IDENTITY_FRAMES_INVALID')
  }
  const valid = images.every(
    image => typeof image === 'string' && image.startsWith('data:image/jpeg;base64,') && image.length <= MAX_IDENTITY_FRAME_CHARS,
  )
  if (!valid) {
    throw new ProctoringPolicyError('身份核验画面格式无效', 'PROCTORING_IDENTITY_FRAMES_INVALID')
  }
  return images as string[]
}

const verifyIdentityImages = async (userId: number, images: string[]): Promise<ProctoringIdentityCheck> => {
  const [{ FaceCredentialRepository }, { analyzeFaces }] = await Promise.all([
    import('@/modules/auth/repositories/face-credential.repository'),
    import('@/modules/auth/services/face-engine.client'),
  ])
  const credentials = await FaceCredentialRepository.listByUser(userId)
  if (credentials.length === 0) {
    return {
      checkId: randomUUID(),
      result: 'failed',
      reasonCode: 'FACE_NOT_ENROLLED',
      similarity: null,
      livenessPassed: null,
      model: null,
    }
  }
  const analysis = await analyzeFaces(images, { needLiveness: true })
  const aggregate = analysis.aggregate
  const singleFace = aggregate.all_single_face && Boolean(aggregate.embedding?.length)
  const livenessPassed = aggregate.liveness?.is_real === true
  let similarity: number | null = null
  if (aggregate.embedding?.length) {
    similarity = Math.max(...credentials.map(item => cosineSimilarity(aggregate.embedding!, item.embedding)))
  }
  const passed = singleFace && livenessPassed && similarity != null && similarity >= FACE_MATCH_THRESHOLD
  const reasonCode = passed
    ? null
    : !singleFace
      ? 'FACE_COUNT_INVALID'
      : !livenessPassed
        ? 'LIVENESS_FAILED'
        : 'FACE_NOT_MATCHED'
  return {
    checkId: randomUUID(),
    result: passed ? 'passed' : 'failed',
    reasonCode,
    similarity,
    livenessPassed,
    model: analysis.model,
  }
}

type ProctoringServiceOptions = {
  now?: () => Date
  identityVerifier?: (userId: number, images: string[]) => Promise<ProctoringIdentityCheck>
  audit?: (input: any, req?: Request) => Promise<unknown>
}

export class ProctoringService {
  private readonly now: () => Date
  private readonly identityVerifier: (userId: number, images: string[]) => Promise<ProctoringIdentityCheck>
  private readonly audit: (input: any, req?: Request) => Promise<unknown>

  constructor(
    private readonly repository: any,
    options: ProctoringServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date())
    this.identityVerifier = options.identityVerifier ?? verifyIdentityImages
    this.audit = options.audit ?? (async (input, req) => {
      const { LogService } = await import('@/modules/logs/services/log.service')
      return LogService.log(input, req)
    })
  }

  private async attemptContext(userId: number, input: { attemptId?: unknown; examId?: unknown }) {
    const attemptId = requireUuid(input.attemptId, 'PROCTORING_ATTEMPT_ID_INVALID', '作答编号')
    const examId = Number(input.examId)
    if (!Number.isSafeInteger(examId) || examId <= 0) {
      throw new ProctoringPolicyError('考试编号无效', 'PROCTORING_EXAM_ID_INVALID')
    }
    const context = await this.repository.getAttemptContext(attemptId, examId, userId)
    if (!context) throw new ProctoringPolicyError('作答不存在或不属于当前用户', 'PROCTORING_ATTEMPT_NOT_FOUND', 404)
    if (context.policy.level !== 'strict') {
      throw new ProctoringPolicyError('本场考试未启用严格监考', 'PROCTORING_NOT_REQUIRED', 409)
    }
    if (['completed', 'submitted', 'graded'].includes(context.resultStatus.toLowerCase())) {
      throw new ProctoringPolicyError('作答已经结束，不能创建监考会话', 'PROCTORING_ATTEMPT_COMPLETED', 409)
    }
    const isMinor = context.ageBand === 'CHILD' || context.ageBand === 'TEEN'
    if (isMinor && !context.allowMinors) {
      throw new ProctoringPolicyError('本场考试未对未成年人开放严格人脸监考', 'PROCTORING_MINOR_DISABLED', 403)
    }
    if (isMinor && !(await this.repository.hasGuardianConsent(userId))) {
      throw new ProctoringPolicyError('缺少监护人针对严格监考的有效专项同意', 'PROCTORING_GUARDIAN_CONSENT_REQUIRED', 403)
    }
    return context
  }

  async createConsent(user: AuthUser | undefined, input: any, req?: Request) {
    const userId = requireUserId(user)
    if (input?.accepted !== true) {
      throw new ProctoringPolicyError('必须明确同意严格监考告知后才能继续', 'PROCTORING_EXPLICIT_CONSENT_REQUIRED')
    }
    const context = await this.attemptContext(userId, input || {})
    if (String(input?.policyVersion || '') !== context.policy.policyVersion) {
      throw new ProctoringPolicyError('监考政策版本已变化，请重新阅读', 'PROCTORING_POLICY_VERSION_CHANGED', 409)
    }
    if (String(input?.noticeVersion || '') !== context.policy.noticeVersion) {
      throw new ProctoringPolicyError('监考告知版本已变化，请重新阅读', 'PROCTORING_NOTICE_VERSION_CHANGED', 409)
    }
    if (context.policy.requireIdentityVerification && input?.biometricConsent !== true) {
      throw new ProctoringPolicyError('人脸身份核验需要单独同意', 'PROCTORING_BIOMETRIC_CONSENT_REQUIRED')
    }
    const categories: string[] = Array.isArray(input?.categories)
      ? [...new Set<string>(input.categories.map((value: unknown) => String(value)))].sort()
      : []
    const expectedCategories = [...STRICT_CATEGORIES].sort()
    if (JSON.stringify(categories) !== JSON.stringify(expectedCategories)) {
      throw new ProctoringPolicyError('监考采集类别确认不完整', 'PROCTORING_CONSENT_CATEGORIES_INVALID')
    }

    const digest = proctoringPolicyDigest(context.policy)
    const existing = await this.repository.findConsentByAttempt(context.attemptId, userId)
    if (existing) {
      assertConsentScope(
        consentScope({
          userId,
          examId: context.examId,
          attemptId: context.attemptId,
          dataRegion: context.dataRegion,
          policyVersion: context.policy.policyVersion,
        }),
        consentScope(existing),
      )
      if (existing.revokedAt || new Date(existing.expiresAt).getTime() <= Date.now() || existing.policyDigest !== digest) {
        throw new ProctoringPolicyError('既有监考同意已失效，请联系考务人员', 'PROCTORING_CONSENT_EXPIRED', 409)
      }
      const existingCategories = [...new Set(existing.categories.map((value: unknown) => String(value)))].sort()
      if (
        existing.noticeVersion !== context.policy.noticeVersion ||
        JSON.stringify(existingCategories) !== JSON.stringify(expectedCategories)
      ) {
        throw new ProctoringPolicyError('既有监考同意与当前告知不一致，请重新确认', 'PROCTORING_CONSENT_NOTICE_MISMATCH', 409)
      }
      return { consent: existing, policy: context.policy, replayed: true }
    }

    const examEnd = context.examEndsAt ? new Date(context.examEndsAt).getTime() : Date.now() + 24 * 60 * 60 * 1000
    const expiresAt = new Date(Math.max(Date.now() + 15 * 60 * 1000, examEnd + 60 * 60 * 1000))
    const consent = await this.repository.insertConsent({
      consentId: randomUUID(),
      context,
      policyDigest: digest,
      categories,
      locale: typeof input?.locale === 'string' ? input.locale.slice(0, 16) : null,
      expiresAt,
    })
    await this.audit(
      {
        type: 'audit',
        status: 'success',
        userId,
        action: '严格监考单独同意',
        message: '用户确认本场严格监考告知',
        resourceType: 'exam',
        resourceId: context.examId,
        details: {
          consentId: consent.consentId,
          attemptId: consent.attemptId,
          policyVersion: consent.policyVersion,
          categories,
          dataRegion: consent.dataRegion,
        },
      },
      req,
    )
    return { consent, policy: context.policy, replayed: false }
  }

  async createSession(user: AuthUser | undefined, input: any) {
    const userId = requireUserId(user)
    const context = await this.attemptContext(userId, input || {})
    const consentId = requireUuid(input?.consentId, 'PROCTORING_CONSENT_ID_INVALID', '同意凭证')
    const consent = await this.repository.findConsentById(consentId, userId)
    if (!consent || consent.revokedAt || new Date(consent.expiresAt).getTime() <= Date.now()) {
      throw new ProctoringPolicyError('监考同意凭证不存在或已失效', 'PROCTORING_CONSENT_EXPIRED', 409)
    }
    assertConsentScope(
      consentScope({
        userId,
        examId: context.examId,
        attemptId: context.attemptId,
        dataRegion: context.dataRegion,
        policyVersion: context.policy.policyVersion,
      }),
      consentScope(consent),
    )
    if (consent.policyDigest !== proctoringPolicyDigest(context.policy)) {
      throw new ProctoringPolicyError('监考政策已变化，请重新确认', 'PROCTORING_POLICY_VERSION_CHANGED', 409)
    }
    const existing = await this.repository.findSessionByAttempt(context.attemptId, userId)
    const session = existing || (await this.repository.insertSession({ sessionId: randomUUID(), consent, context }))
    return { session, policy: context.policy, decision: decisionFor(session), replayed: Boolean(existing) }
  }

  async getSession(user: AuthUser | undefined, sessionIdValue: unknown) {
    const userId = requireUserId(user)
    const sessionId = requireUuid(sessionIdValue, 'PROCTORING_SESSION_ID_INVALID', '监考会话')
    const session = await this.repository.findSessionById(sessionId, userId)
    if (!session) throw new ProctoringPolicyError('监考会话不存在', 'PROCTORING_SESSION_NOT_FOUND', 404)
    return { session, decision: decisionFor(session) }
  }

  async recordFactualEvent(user: AuthUser | undefined, sessionIdValue: unknown, input: any) {
    const userId = requireUserId(user)
    const sessionId = requireUuid(sessionIdValue, 'PROCTORING_SESSION_ID_INVALID', '监考会话')
    const session = await this.repository.findSessionById(sessionId, userId)
    if (!session) throw new ProctoringPolicyError('监考会话不存在', 'PROCTORING_SESSION_NOT_FOUND', 404)
    const event = normalizeFactualEvent(input || {}, this.now())
    if (SERVER_ONLY_EVENTS.has(event.type)) {
      throw new ProctoringPolicyError('身份核验结果只能由服务端生成', 'PROCTORING_EVENT_NOT_ALLOWED')
    }
    if (event.type === 'session_started') {
      const identityReady = session.identityStatus === 'passed' || session.identityStatus === 'not_required'
      if (!identityReady) {
        throw new ProctoringPolicyError('身份核验尚未完成', 'PROCTORING_IDENTITY_REQUIRED', 409)
      }
      if (
        event.state.camera !== 'available' ||
        event.state.microphone !== 'available' ||
        event.state.app !== 'foreground' ||
        event.state.network !== 'online'
      ) {
        throw new ProctoringPolicyError('严格监考传感器或网络未就绪', 'PROCTORING_SENSORS_NOT_READY', 409)
      }
    }
    const nextState = nextSessionState(session.state, event.type)
    const result = await this.repository.recordEvent({
      sessionId,
      userId,
      event,
      nextState,
      reviewReasonCode: nextState === 'review_required' ? event.type.toUpperCase() : null,
      reviewCaseId: nextState === 'review_required' ? randomUUID() : null,
    })
    return { ...result, decision: decisionFor(result.session) }
  }

  async heartbeat(user: AuthUser | undefined, sessionIdValue: unknown, input: any) {
    const userId = requireUserId(user)
    const sessionId = requireUuid(sessionIdValue, 'PROCTORING_SESSION_ID_INVALID', '监考会话')
    const session = await this.repository.findSessionById(sessionId, userId)
    if (!session) throw new ProctoringPolicyError('监考会话不存在', 'PROCTORING_SESSION_NOT_FOUND', 404)
    if (session.state === 'completed' || session.state === 'review_required') {
      return { session, decision: decisionFor(session) }
    }
    const context = await this.attemptContext(userId, { attemptId: session.attemptId, examId: session.examId })
    const now = this.now()
    const healthReady =
      input?.camera === 'available' &&
      input?.microphone === 'available' &&
      input?.app === 'foreground' &&
      input?.network === 'online' &&
      (session.identityStatus === 'passed' || session.identityStatus === 'not_required')
    let nextState: ProctoringSessionState = healthReady ? session.state : 'interrupted'
    let resume = false
    let reviewReasonCode: string | null = null
    if (session.lastHeartbeatAt) {
      const heartbeatState = assessHeartbeat(
        new Date(session.lastHeartbeatAt),
        now,
        context.policy.interruptionGraceSeconds,
      )
      if (heartbeatState === 'review_required') {
        nextState = 'review_required'
        reviewReasonCode = 'HEARTBEAT_TIMEOUT'
      }
      else if (heartbeatState === 'interrupted') nextState = 'interrupted'
    }
    const interruptionAge = session.interruptionStartedAt
      ? (now.getTime() - new Date(session.interruptionStartedAt).getTime()) / 1000
      : 0
    if (
      nextState !== 'review_required' &&
      session.interruptionStartedAt &&
      interruptionAge > context.policy.interruptionGraceSeconds
    ) {
      nextState = 'review_required'
      reviewReasonCode = 'SENSOR_INTERRUPTION_TIMEOUT'
    }
    if (healthReady && nextState !== 'review_required') {
      if (!session.interruptionStartedAt || interruptionAge <= context.policy.interruptionGraceSeconds) {
        nextState = 'active'
        resume = true
      } else {
        nextState = 'review_required'
        reviewReasonCode = 'SENSOR_INTERRUPTION_TIMEOUT'
      }
    }
    const updated = await this.repository.heartbeat({
      sessionId,
      userId,
      state: nextState,
      resume,
      reviewReasonCode,
      reviewCaseId: nextState === 'review_required' ? randomUUID() : null,
    })
    if (!updated) throw new ProctoringPolicyError('监考会话不存在', 'PROCTORING_SESSION_NOT_FOUND', 404)
    return { session: updated, decision: decisionFor(updated), serverNow: now.toISOString() }
  }

  async verifyIdentity(user: AuthUser | undefined, sessionIdValue: unknown, input: any) {
    const userId = requireUserId(user)
    const sessionId = requireUuid(sessionIdValue, 'PROCTORING_SESSION_ID_INVALID', '监考会话')
    const session = await this.repository.findSessionById(sessionId, userId)
    if (!session) throw new ProctoringPolicyError('监考会话不存在', 'PROCTORING_SESSION_NOT_FOUND', 404)
    if (!session.identityRequired) return { session, result: { result: 'passed', reasonCode: null }, decision: decisionFor(session) }
    if (session.identityStatus === 'passed') {
      return { session, result: { result: 'passed', reasonCode: null }, decision: decisionFor(session), replayed: true }
    }
    if (session.state !== 'prepared') {
      throw new ProctoringPolicyError('当前监考状态不允许身份核验', 'PROCTORING_IDENTITY_STATE_INVALID', 409)
    }
    const images = validateIdentityFrames(input?.images)
    const check = await this.identityVerifier(userId, images)
    const updated = await this.repository.insertIdentityCheck({
      session,
      check,
      reviewCaseId: check.result === 'failed' ? randomUUID() : null,
    })
    await this.audit({
      type: 'audit',
      status: check.result === 'passed' ? 'success' : 'failed',
      userId,
      action: '严格监考身份核验',
      message: check.result === 'passed' ? '身份核验通过' : '身份核验未通过',
      resourceType: 'exam',
      resourceId: session.examId,
      details: {
        sessionId: session.sessionId,
        checkId: check.checkId,
        result: check.result,
        reasonCode: check.reasonCode,
        model: check.model,
      },
    })
    return { session: updated, result: check, decision: decisionFor(updated), replayed: false }
  }

  async complete(user: AuthUser | undefined, sessionIdValue: unknown, input: any) {
    return this.recordFactualEvent(user, sessionIdValue, { ...input, type: 'session_completed' })
  }

  async listExamEvents(user: AuthUser | undefined, examId: number, query: any): Promise<ProctoringListResult> {
    const userId = requireUserId(user)
    const role = pickRole(user)
    const isStaff = role === 'admin' || role === 'teacher'
    const page = Math.max(1, parseInt(String(query?.page || '1')) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || '20')) || 20))
    const severity = query?.severity ? toSeverity(String(query.severity)) : undefined
    const scopedUserId = isStaff && query?.user_id ? Number(query.user_id) : userId
    const list = await this.repository.listByExam({
      examId,
      userId: Number.isFinite(scopedUserId) ? scopedUserId : undefined,
      severity,
      page,
      limit,
    })
    const summary = await this.repository.summaryByExam(
      examId,
      Number.isFinite(scopedUserId) ? scopedUserId : undefined,
    )
    return { ...list, summary }
  }
}

export default ProctoringService
