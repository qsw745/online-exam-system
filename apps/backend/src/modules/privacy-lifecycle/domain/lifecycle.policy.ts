import { createHash, timingSafeEqual } from 'node:crypto'

import type {
  DataRegion,
  LifecycleAccountType,
  LifecycleCategoryCode,
  LifecycleCategoryPolicy,
  LifecyclePolicySnapshot,
  LifecycleStatus,
  LifecycleStepProjection,
  RetentionAction,
  RetentionAnchor,
} from './lifecycle.model'

export * from './lifecycle.model'

export const LIFECYCLE_POLICY_VERSION = 'wenheng-lifecycle-2026-08-v1'

export class LifecyclePolicyError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'LifecyclePolicyError'
  }
}

export type ResolveLifecyclePolicyInput = {
  dataRegion: DataRegion
  accountType: LifecycleAccountType
  createdAt: Date
  institutionExamRetentionDays?: number
  existingRetainUntil?: Partial<Record<LifecycleCategoryCode, string>>
}

const DAY_MS = 24 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const STATUS_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

const retentionRule = (
  action: RetentionAction,
  retentionDays: number | null,
  anchor: RetentionAnchor,
  createdAt: Date,
  existingRetainUntil?: string,
): LifecycleCategoryPolicy => {
  let retainUntil: string | null = null
  if (existingRetainUntil !== undefined) {
    const existing = new Date(existingRetainUntil)
    if (Number.isNaN(existing.getTime()) || existing.toISOString() !== existingRetainUntil) {
      throw new LifecyclePolicyError('已有数据期限无效', 'LIFECYCLE_POLICY_RETAIN_UNTIL_INVALID')
    }
    retainUntil = existingRetainUntil
  } else if (retentionDays !== null && anchor === 'DATA_CREATED') {
    retainUntil = new Date(createdAt.getTime() + retentionDays * DAY_MS).toISOString()
  }
  return { action, retentionDays, retainUntil, anchor }
}

export function resolveLifecyclePolicy(input: ResolveLifecyclePolicyInput): LifecyclePolicySnapshot {
  if (input.dataRegion !== 'CN' && input.dataRegion !== 'GLOBAL') {
    throw new LifecyclePolicyError('数据区域无效', 'LIFECYCLE_POLICY_REGION_INVALID')
  }
  if (input.accountType !== 'PERSONAL' && input.accountType !== 'INSTITUTION') {
    throw new LifecyclePolicyError('账号类型无效', 'LIFECYCLE_POLICY_ACCOUNT_TYPE_INVALID')
  }
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new LifecyclePolicyError('策略生效时间无效', 'LIFECYCLE_POLICY_CREATED_AT_INVALID')
  }

  const institutionDays = input.institutionExamRetentionDays ?? 1095
  if (
    input.accountType === 'INSTITUTION' &&
    (!Number.isInteger(institutionDays) || institutionDays < 365 || institutionDays > 1825)
  ) {
    throw new LifecyclePolicyError('机构考试期限必须在一至五年范围内', 'LIFECYCLE_POLICY_OUT_OF_RANGE')
  }
  const examRetentionDays = input.accountType === 'INSTITUTION' ? institutionDays : 365
  const existing = input.existingRetainUntil ?? {}

  return {
    version: LIFECYCLE_POLICY_VERSION,
    dataRegion: input.dataRegion,
    accountType: input.accountType,
    createdAt: input.createdAt.toISOString(),
    categories: {
      AUTH_CREDENTIALS: retentionRule('DELETE', null, 'ACCOUNT_DELETION', input.createdAt, existing.AUTH_CREDENTIALS),
      FACE_CREDENTIALS: retentionRule(
        'DELETE',
        null,
        'CONSENT_WITHDRAWAL_OR_ACCOUNT_DELETION',
        input.createdAt,
        existing.FACE_CREDENTIALS,
      ),
      PROFILE_AND_SETTINGS: retentionRule(
        'DELETE',
        null,
        'ACCOUNT_DELETION',
        input.createdAt,
        existing.PROFILE_AND_SETTINGS,
      ),
      USER_CONTENT: retentionRule('ANONYMIZE', null, 'ACCOUNT_DELETION', input.createdAt, existing.USER_CONTENT),
      EXAM_ARCHIVE: retentionRule(
        'ANONYMIZE',
        examRetentionDays,
        'DATA_CREATED',
        input.createdAt,
        existing.EXAM_ARCHIVE,
      ),
      PROCTORING_AND_IDENTITY: retentionRule(
        'RESTRICTED_RETENTION',
        180,
        'EXAM_ENDED',
        input.createdAt,
        existing.PROCTORING_AND_IDENTITY,
      ),
      MEMBERSHIPS_AND_RANKINGS: retentionRule(
        'DELETE',
        null,
        'ACCOUNT_DELETION',
        input.createdAt,
        existing.MEMBERSHIPS_AND_RANKINGS,
      ),
      SECURITY_LOGS: retentionRule('ANONYMIZE', 180, 'DATA_CREATED', input.createdAt, existing.SECURITY_LOGS),
      ACCOUNT_ROW: retentionRule('DELETE', null, 'ACCOUNT_DELETION', input.createdAt, existing.ACCOUNT_ROW),
      RECEIPT_AND_TOMBSTONE: retentionRule(
        'NO_SUBJECT_DATA',
        1095,
        'DATA_CREATED',
        input.createdAt,
        existing.RECEIPT_AND_TOMBSTONE,
      ),
    },
    identityRawImageRetentionDays: 0,
    reviewMinimumAfterCloseDays: 30,
    backupMaximumRetentionDays: 30,
  }
}

export function deriveLifecycleStatus(steps: readonly LifecycleStepProjection[]): LifecycleStatus {
  if (steps.length === 0) return 'REQUESTED'
  if (steps.some(step => step.status === 'ATTENTION_REQUIRED')) return 'ATTENTION_REQUIRED'
  if (steps.some(step => step.status === 'RUNNING')) return 'RUNNING'
  if (steps.some(step => step.status === 'RETRYING')) return 'RETRYING'

  const held = steps.filter(step => step.status === 'HELD')
  if (held.length > 0) {
    const otherStepsComplete = steps.every(step => step.status === 'HELD' || step.status === 'COMPLETED')
    const onlyRestrictedRetentionHeld = held.every(step => step.action === 'RESTRICTED_RETENTION')
    if (otherStepsComplete && onlyRestrictedRetentionHeld) return 'COMPLETED_WITH_RESTRICTED_RETENTION'
    return 'HELD'
  }

  if (steps.some(step => step.status === 'PENDING')) return 'SCHEDULED'
  return 'COMPLETED'
}

export function normalizeLifecycleUuid(value: unknown, label = '操作编号'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new LifecyclePolicyError(`${label}无效`, 'LIFECYCLE_UUID_INVALID')
  }
  return value
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
      if (!Number.isFinite(value)) {
        throw new LifecyclePolicyError('请求内容无法生成摘要', 'LIFECYCLE_DIGEST_INPUT_INVALID')
      }
      return JSON.stringify(value)
    case 'undefined':
      return 'null'
    case 'object': {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
      return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`).join(',')}}`
    }
    default:
      throw new LifecyclePolicyError('请求内容无法生成摘要', 'LIFECYCLE_DIGEST_INPUT_INVALID')
  }
}

export function lifecycleRequestDigest(payload: unknown): string {
  return createHash('sha256').update(stableSerialize(payload), 'utf8').digest('hex')
}

export function normalizeDeletionStatusToken(value: unknown): string {
  if (typeof value !== 'string' || !STATUS_TOKEN_RE.test(value)) {
    throw new LifecyclePolicyError('注销状态凭证无效', 'LIFECYCLE_STATUS_TOKEN_INVALID')
  }
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.length !== 32 || decoded.toString('base64url') !== value) {
    throw new LifecyclePolicyError('注销状态凭证无效', 'LIFECYCLE_STATUS_TOKEN_INVALID')
  }
  return value
}

export function digestDeletionStatusToken(value: unknown): string {
  return createHash('sha256').update(normalizeDeletionStatusToken(value), 'utf8').digest('hex')
}

export function verifyDeletionStatusToken(value: unknown, digest: unknown): boolean {
  try {
    const candidate = Buffer.from(digestDeletionStatusToken(value), 'hex')
    if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest)) return false
    const expected = Buffer.from(digest, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}
