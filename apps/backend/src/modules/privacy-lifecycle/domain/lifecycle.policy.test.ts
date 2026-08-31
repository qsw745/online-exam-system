import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LifecyclePolicyError,
  deriveLifecycleStatus,
  digestDeletionStatusToken,
  lifecycleRequestDigest,
  normalizeDeletionStatusToken,
  normalizeLifecycleUuid,
  resolveLifecyclePolicy,
  verifyDeletionStatusToken,
} from './lifecycle.policy'

const expectPolicyError = (code: string) => (error: unknown) =>
  error instanceof LifecyclePolicyError && error.code === code

test('机构考试期限只能在平台允许的一至五年范围内', () => {
  const policy = resolveLifecyclePolicy({
    dataRegion: 'CN',
    accountType: 'INSTITUTION',
    institutionExamRetentionDays: 1095,
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
  })

  assert.equal(policy.version, 'wenheng-lifecycle-2026-08-v1')
  assert.equal(policy.dataRegion, 'CN')
  assert.equal(policy.categories.EXAM_ARCHIVE.retentionDays, 1095)
  assert.equal(policy.categories.EXAM_ARCHIVE.retainUntil, '2029-08-30T00:00:00.000Z')
  assert.equal(policy.categories.FACE_CREDENTIALS.action, 'DELETE')

  for (const days of [364, 1826]) {
    assert.throws(
      () => resolveLifecyclePolicy({
        dataRegion: 'CN',
        accountType: 'INSTITUTION',
        institutionExamRetentionDays: days,
        createdAt: new Date('2026-08-31T00:00:00.000Z'),
      }),
      expectPolicyError('LIFECYCLE_POLICY_OUT_OF_RANGE'),
    )
  }
})

test('个人、监考、日志、回执和原始身份画面使用确认的首发期限', () => {
  const policy = resolveLifecyclePolicy({
    dataRegion: 'GLOBAL',
    accountType: 'PERSONAL',
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
  })

  assert.equal(policy.categories.EXAM_ARCHIVE.retentionDays, 365)
  assert.equal(policy.categories.PROCTORING_AND_IDENTITY.retentionDays, 180)
  assert.equal(policy.categories.SECURITY_LOGS.retentionDays, 180)
  assert.equal(policy.categories.RECEIPT_AND_TOMBSTONE.retentionDays, 1095)
  assert.equal(policy.identityRawImageRetentionDays, 0)
  assert.equal(policy.reviewMinimumAfterCloseDays, 30)
  assert.equal(policy.backupMaximumRetentionDays, 30)
})

test('已有固化期限不会被后续策略静默延长', () => {
  const policy = resolveLifecyclePolicy({
    dataRegion: 'CN',
    accountType: 'INSTITUTION',
    institutionExamRetentionDays: 1825,
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    existingRetainUntil: {
      EXAM_ARCHIVE: '2027-08-31T00:00:00.000Z',
    },
  })

  assert.equal(policy.categories.EXAM_ARCHIVE.retentionDays, 1825)
  assert.equal(policy.categories.EXAM_ARCHIVE.retainUntil, '2027-08-31T00:00:00.000Z')
})

test('状态由步骤推导且合法隔离保留不会伪装成完全删除', () => {
  assert.equal(deriveLifecycleStatus([]), 'REQUESTED')
  assert.equal(deriveLifecycleStatus([{ status: 'PENDING', action: 'DELETE' }]), 'SCHEDULED')
  assert.equal(deriveLifecycleStatus([{ status: 'RUNNING', action: 'DELETE' }]), 'RUNNING')
  assert.equal(deriveLifecycleStatus([{ status: 'RETRYING', action: 'DELETE' }]), 'RETRYING')
  assert.equal(deriveLifecycleStatus([{ status: 'ATTENTION_REQUIRED', action: 'DELETE' }]), 'ATTENTION_REQUIRED')
  assert.equal(deriveLifecycleStatus([
    { status: 'COMPLETED', action: 'DELETE' },
    { status: 'HELD', action: 'RESTRICTED_RETENTION' },
  ]), 'COMPLETED_WITH_RESTRICTED_RETENTION')
  assert.equal(deriveLifecycleStatus([
    { status: 'PENDING', action: 'DELETE' },
    { status: 'HELD', action: 'RESTRICTED_RETENTION' },
  ]), 'HELD')
  assert.equal(deriveLifecycleStatus([{ status: 'COMPLETED', action: 'DELETE' }]), 'COMPLETED')
})

test('请求编号只接受规范小写 UUID', () => {
  const uuid = '1132689c-4a5d-42a2-86c5-3661e62d4d1f'
  assert.equal(normalizeLifecycleUuid(uuid, '请求编号'), uuid)
  assert.throws(
    () => normalizeLifecycleUuid(uuid.toUpperCase(), '请求编号'),
    expectPolicyError('LIFECYCLE_UUID_INVALID'),
  )
  assert.throws(
    () => normalizeLifecycleUuid('not-a-uuid', '请求编号'),
    expectPolicyError('LIFECYCLE_UUID_INVALID'),
  )
})

test('请求摘要忽略对象键顺序但保留数组顺序', () => {
  const first = lifecycleRequestDigest({ b: 2, a: { y: [2, 1], x: true } })
  const reordered = lifecycleRequestDigest({ a: { x: true, y: [2, 1] }, b: 2 })
  const changed = lifecycleRequestDigest({ a: { x: true, y: [1, 2] }, b: 2 })

  assert.equal(first, reordered)
  assert.notEqual(first, changed)
  assert.match(first, /^[0-9a-f]{64}$/)
})

test('状态令牌只接受规范的 32 字节 Base64URL 值并用恒定时间校验', () => {
  const token = Buffer.alloc(32, 7).toString('base64url')
  const digest = digestDeletionStatusToken(token)

  assert.equal(normalizeDeletionStatusToken(token), token)
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.equal(verifyDeletionStatusToken(token, digest), true)
  assert.equal(verifyDeletionStatusToken(Buffer.alloc(32, 8).toString('base64url'), digest), false)
  assert.equal(verifyDeletionStatusToken(`${token}x`, digest), false)
  assert.throws(
    () => normalizeDeletionStatusToken('short-token'),
    expectPolicyError('LIFECYCLE_STATUS_TOKEN_INVALID'),
  )
})
