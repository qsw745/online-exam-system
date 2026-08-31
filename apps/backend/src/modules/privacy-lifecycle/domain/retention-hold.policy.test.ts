import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeRetentionHold } from './retention-hold.policy'

const NOW = new Date('2026-08-31T00:00:00.000Z')

test('人脸和认证凭据不能创建合法冻结', () => {
  for (const category of ['FACE_CREDENTIALS', 'AUTH_CREDENTIALS'] as const) {
    assert.throws(
      () => normalizeRetentionHold({
        category,
        scopeType: 'USER_REQUEST',
        scopeId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
        reasonCode: 'LEGAL_DISPUTE',
        legalBasisReference: '案号 2026-08-31-01',
        expiresAt: '2026-09-30T00:00:00.000Z',
      }, NOW),
      (error: any) => error.code === 'LIFECYCLE_HOLD_CATEGORY_FORBIDDEN',
    )
  }
})

test('冻结必须有依据、晚于当前时间且不能超过一年', () => {
  const base = {
    category: 'EXAM_ARCHIVE' as const,
    scopeType: 'USER_REQUEST' as const,
    scopeId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    reasonCode: 'LEGAL_DISPUTE' as const,
    legalBasisReference: '案号 2026-08-31-01',
  }
  assert.throws(() => normalizeRetentionHold({ ...base, expiresAt: NOW.toISOString() }, NOW), (error: any) => error.code === 'LIFECYCLE_HOLD_EXPIRY_INVALID')
  assert.throws(() => normalizeRetentionHold({ ...base, legalBasisReference: ' ', expiresAt: '2026-09-30T00:00:00.000Z' }, NOW), (error: any) => error.code === 'LIFECYCLE_HOLD_BASIS_REQUIRED')
  assert.throws(() => normalizeRetentionHold({ ...base, expiresAt: '2028-01-01T00:00:00.000Z' }, NOW), (error: any) => error.code === 'LIFECYCLE_HOLD_EXPIRY_TOO_LONG')
})

test('冻结输入被规范化且摘要不受对象键顺序影响', () => {
  const value = normalizeRetentionHold({
    category: 'SECURITY_LOGS', scopeType: 'USER_REQUEST',
    scopeId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f', reasonCode: 'REGULATORY_REQUEST',
    legalBasisReference: '  监管函 2026-09  ', expiresAt: '2026-10-01T00:00:00.000Z',
  }, NOW)
  assert.equal(value.legalBasisReference, '监管函 2026-09')
  assert.match(value.requestDigest, /^[a-f0-9]{64}$/)
})
