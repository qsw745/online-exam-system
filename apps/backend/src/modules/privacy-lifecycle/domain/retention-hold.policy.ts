import { createHash } from 'node:crypto'

import type { LifecycleCategoryCode } from './lifecycle.model'
import { LifecyclePolicyError } from './lifecycle.policy'

export const HOLDABLE_CATEGORIES = new Set<LifecycleCategoryCode>([
  'EXAM_ARCHIVE', 'PROCTORING_AND_IDENTITY', 'SECURITY_LOGS', 'RECEIPT_AND_TOMBSTONE',
])
export const RETENTION_HOLD_MAX_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000
const REASONS = new Set(['LEGAL_DISPUTE', 'REGULATORY_REQUEST', 'SECURITY_INCIDENT', 'CONTRACTUAL_ARCHIVE'])

export type RetentionHoldInput = {
  category: LifecycleCategoryCode
  scopeType: 'USER_REQUEST' | 'RETENTION_SCAN'
  scopeId: string
  reasonCode: 'LEGAL_DISPUTE' | 'REGULATORY_REQUEST' | 'SECURITY_INCIDENT' | 'CONTRACTUAL_ARCHIVE'
  legalBasisReference: string
  expiresAt: string
}

export function normalizeRetentionHold(input: RetentionHoldInput, now: Date) {
  if (!HOLDABLE_CATEGORIES.has(input.category)) throw new LifecyclePolicyError('该数据类别不可冻结', 'LIFECYCLE_HOLD_CATEGORY_FORBIDDEN')
  if (input.scopeType !== 'USER_REQUEST' && input.scopeType !== 'RETENTION_SCAN') throw new LifecyclePolicyError('冻结范围无效', 'LIFECYCLE_HOLD_SCOPE_INVALID')
  const scopeId = String(input.scopeId || '').trim()
  if (!scopeId) throw new LifecyclePolicyError('冻结范围编号不能为空', 'LIFECYCLE_HOLD_SCOPE_INVALID')
  if (!REASONS.has(input.reasonCode)) throw new LifecyclePolicyError('冻结原因无效', 'LIFECYCLE_HOLD_REASON_INVALID')
  const legalBasisReference = String(input.legalBasisReference || '').trim()
  if (!legalBasisReference) throw new LifecyclePolicyError('冻结依据不能为空', 'LIFECYCLE_HOLD_BASIS_REQUIRED')
  if (legalBasisReference.length > 500) throw new LifecyclePolicyError('冻结依据过长', 'LIFECYCLE_HOLD_BASIS_INVALID')
  const expiresAt = new Date(input.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw new LifecyclePolicyError('冻结到期时间必须晚于当前时间', 'LIFECYCLE_HOLD_EXPIRY_INVALID')
  if (expiresAt.getTime() > now.getTime() + RETENTION_HOLD_MAX_DAYS * DAY_MS) throw new LifecyclePolicyError('单次冻结不能超过一年', 'LIFECYCLE_HOLD_EXPIRY_TOO_LONG')
  const canonical = { category: input.category, scopeType: input.scopeType, scopeId, reasonCode: input.reasonCode, legalBasisReference, expiresAt: expiresAt.toISOString() }
  return { ...canonical, requestDigest: createHash('sha256').update(JSON.stringify(canonical)).digest('hex') }
}
