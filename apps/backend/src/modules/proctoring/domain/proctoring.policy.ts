import { createHash } from 'node:crypto'

export type ProctoringLevel = 'off' | 'strict'
export type ProctoringSessionState = 'prepared' | 'active' | 'interrupted' | 'review_required' | 'completed'
export type ProctoringDataRegion = 'cn' | 'global'

export type ProctoringPolicy = {
  level: ProctoringLevel
  policyVersion: string
  noticeVersion: string
  requireCamera: boolean
  requireMicrophone: boolean
  requireIdentityVerification: boolean
  eventRetentionDays: number
  snapshotRetentionDays: number
  heartbeatIntervalSeconds: number
  interruptionGraceSeconds: number
}

export type ProctoringConsentScope = {
  userId: number
  examId: number
  attemptId: string
  dataRegion: ProctoringDataRegion
  policyVersion: string
}

export type FactualEventType =
  | 'session_started'
  | 'session_completed'
  | 'app_backgrounded'
  | 'app_foregrounded'
  | 'network_lost'
  | 'network_restored'
  | 'camera_interrupted'
  | 'camera_restored'
  | 'camera_permission_revoked'
  | 'microphone_interrupted'
  | 'microphone_restored'
  | 'microphone_permission_revoked'
  | 'face_missing'
  | 'multiple_faces'
  | 'camera_obscured'
  | 'screen_capture_started'
  | 'screen_capture_stopped'
  | 'identity_verification_passed'
  | 'identity_verification_failed'

export type FactualEventSeverity = 'info' | 'warn' | 'critical'

export type NormalizedFactualEvent = {
  eventId: string
  type: FactualEventType
  sequence: number
  occurredAt: string
  severity: FactualEventSeverity
  state: {
    camera?: 'available' | 'interrupted' | 'denied' | 'unavailable'
    microphone?: 'available' | 'interrupted' | 'denied' | 'unavailable'
    app?: 'foreground' | 'background'
    faceCount?: 0 | 1 | 2
    light?: 'normal' | 'dark'
    network?: 'online' | 'offline'
    screenCaptured?: boolean
  }
}

export class ProctoringPolicyError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'ProctoringPolicyError'
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DEFAULT_POLICY_VERSION = 'wenheng-proctoring-2026-08-v1'
const DEFAULT_NOTICE_VERSION = 'wenheng-proctoring-notice-2026-08-v1'

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

export function normalizeProctoringPolicy(input?: Record<string, unknown> | null): ProctoringPolicy {
  const strict = String(input?.level || '').toLowerCase() === 'strict'
  return {
    level: strict ? 'strict' : 'off',
    policyVersion: String(input?.policyVersion || DEFAULT_POLICY_VERSION).slice(0, 80),
    noticeVersion: String(input?.noticeVersion || DEFAULT_NOTICE_VERSION).slice(0, 80),
    requireCamera: strict,
    requireMicrophone: strict,
    requireIdentityVerification: strict && input?.requireIdentityVerification !== false,
    eventRetentionDays: clampInt(input?.eventRetentionDays, 180, 30, 365),
    snapshotRetentionDays: strict ? clampInt(input?.snapshotRetentionDays, 0, 0, 30) : 0,
    heartbeatIntervalSeconds: clampInt(input?.heartbeatIntervalSeconds, 15, 10, 60),
    interruptionGraceSeconds: clampInt(input?.interruptionGraceSeconds, 45, 15, 180),
  }
}

export function proctoringPolicyDigest(policy: ProctoringPolicy): string {
  return createHash('sha256').update(JSON.stringify(policy)).digest('hex')
}

export function assertConsentScope(expected: ProctoringConsentScope, actual: ProctoringConsentScope): void {
  const matches =
    expected.userId === actual.userId &&
    expected.examId === actual.examId &&
    expected.attemptId === actual.attemptId &&
    expected.dataRegion === actual.dataRegion &&
    expected.policyVersion === actual.policyVersion
  if (!matches) {
    throw new ProctoringPolicyError('监考同意凭证与当前考试不匹配', 'PROCTORING_CONSENT_SCOPE_MISMATCH', 409)
  }
}

const EVENT_SEVERITY: Record<FactualEventType, FactualEventSeverity> = {
  session_started: 'info',
  session_completed: 'info',
  app_backgrounded: 'warn',
  app_foregrounded: 'info',
  network_lost: 'warn',
  network_restored: 'info',
  camera_interrupted: 'critical',
  camera_restored: 'info',
  camera_permission_revoked: 'critical',
  microphone_interrupted: 'critical',
  microphone_restored: 'info',
  microphone_permission_revoked: 'critical',
  face_missing: 'warn',
  multiple_faces: 'critical',
  camera_obscured: 'warn',
  screen_capture_started: 'critical',
  screen_capture_stopped: 'info',
  identity_verification_passed: 'info',
  identity_verification_failed: 'critical',
}

const EVENT_TYPES = new Set(Object.keys(EVENT_SEVERITY))

const enumValue = <T extends string>(value: unknown, values: readonly T[]): T | undefined =>
  values.includes(value as T) ? (value as T) : undefined

export function normalizeFactualEvent(input: Record<string, any>, receivedAt = new Date()): NormalizedFactualEvent {
  const eventId = String(input?.eventId || '').trim()
  if (!UUID_RE.test(eventId)) {
    throw new ProctoringPolicyError('监考事件编号无效', 'PROCTORING_EVENT_ID_INVALID')
  }
  const type = String(input?.type || '').trim() as FactualEventType
  if (!EVENT_TYPES.has(type)) {
    throw new ProctoringPolicyError('不允许的监考事件类型', 'PROCTORING_EVENT_NOT_ALLOWED')
  }
  const sequence = Number(input?.sequence)
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new ProctoringPolicyError('监考事件序号无效', 'PROCTORING_EVENT_SEQUENCE_INVALID')
  }
  const occurredAt = new Date(String(input?.occurredAt || ''))
  const drift = Math.abs(receivedAt.getTime() - occurredAt.getTime())
  if (Number.isNaN(occurredAt.getTime()) || drift > 5 * 60 * 1000) {
    throw new ProctoringPolicyError('监考事件时间无效', 'PROCTORING_EVENT_TIME_INVALID')
  }

  const raw = input?.state && typeof input.state === 'object' ? input.state : {}
  const state: NormalizedFactualEvent['state'] = {}
  const camera = enumValue(raw.camera, ['available', 'interrupted', 'denied', 'unavailable'] as const)
  const microphone = enumValue(raw.microphone, ['available', 'interrupted', 'denied', 'unavailable'] as const)
  const app = enumValue(raw.app, ['foreground', 'background'] as const)
  const light = enumValue(raw.light, ['normal', 'dark'] as const)
  const network = enumValue(raw.network, ['online', 'offline'] as const)
  if (camera) state.camera = camera
  if (microphone) state.microphone = microphone
  if (app) state.app = app
  if (light) state.light = light
  if (network) state.network = network
  if (raw.faceCount === 0 || raw.faceCount === 1 || raw.faceCount === 2) state.faceCount = raw.faceCount
  if (typeof raw.screenCaptured === 'boolean') state.screenCaptured = raw.screenCaptured

  return {
    eventId,
    type,
    sequence,
    occurredAt: occurredAt.toISOString(),
    severity: EVENT_SEVERITY[type],
    state,
  }
}

const INTERRUPTION_EVENTS = new Set<FactualEventType>([
  'app_backgrounded',
  'network_lost',
  'camera_interrupted',
  'camera_permission_revoked',
  'microphone_interrupted',
  'microphone_permission_revoked',
  'screen_capture_started',
])

const DIRECT_REVIEW_EVENTS = new Set<FactualEventType>([
  'multiple_faces',
  'screen_capture_started',
  'identity_verification_failed',
])

export function nextSessionState(current: ProctoringSessionState, eventType: FactualEventType): ProctoringSessionState {
  if (current === 'completed' || current === 'review_required') return current
  if (eventType === 'session_completed') return 'completed'
  if (DIRECT_REVIEW_EVENTS.has(eventType)) return 'review_required'
  if (INTERRUPTION_EVENTS.has(eventType)) return 'interrupted'
  if (current === 'prepared' && eventType === 'session_started') return 'active'
  return current
}

export function assessHeartbeat(lastHeartbeatAt: Date, now: Date, graceSeconds: number): ProctoringSessionState {
  const elapsed = Math.max(0, now.getTime() - lastHeartbeatAt.getTime()) / 1000
  if (elapsed <= graceSeconds) return 'active'
  if (elapsed <= graceSeconds * 4) return 'interrupted'
  return 'review_required'
}
