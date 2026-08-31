import assert from 'node:assert/strict'
import test from 'node:test'
import {
  escapeCsvCell,
  normalizeAppealReasonCode,
  normalizeReviewText,
  normalizeReviewUuid,
  ProctoringReviewPolicyError,
  reviewRequestDigest,
  transitionReviewCase,
  validateDecisionReason,
  type ReviewCaseProjection,
} from './proctoring-review.policy.js'

const pendingCase: ReviewCaseProjection = {
  status: 'pending_review',
  outcome: 'pending',
  version: 1,
  firstDecidedAt: null,
  appealDeadlineAt: null,
  closedAt: null,
  updatedAt: '2026-08-30T09:00:00.000Z',
}

const expectPolicyError = (code: string) => (error: unknown) =>
  error instanceof ProctoringReviewPolicyError && error.code === code

test('确认违规只改变复核投影并生成七天申诉期限', () => {
  const now = new Date('2026-08-30T10:00:00.000Z')
  const next = transitionReviewCase(
    pendingCase,
    {
      action: 'confirm_violation',
      expectedVersion: 1,
    },
    now,
  )

  assert.deepEqual(next, {
    ...pendingCase,
    status: 'decided',
    outcome: 'violation_confirmed',
    version: 2,
    firstDecidedAt: '2026-08-30T10:00:00.000Z',
    appealDeadlineAt: '2026-09-06T10:00:00.000Z',
    closedAt: null,
    updatedAt: '2026-08-30T10:00:00.000Z',
  })
})

test('请求补充后只有考生回复可以把案件退回待复核', () => {
  const requested = transitionReviewCase(
    pendingCase,
    { action: 'request_information', expectedVersion: 1 },
    new Date('2026-08-30T10:00:00.000Z'),
  )
  assert.equal(requested.status, 'information_requested')
  assert.equal(requested.version, 2)

  const responded = transitionReviewCase(
    requested,
    { action: 'candidate_response', expectedVersion: 2 },
    new Date('2026-08-30T11:00:00.000Z'),
  )
  assert.equal(responded.status, 'pending_review')
  assert.equal(responded.version, 3)
})

test('排除异常后案件立即结束且不能申诉或继续写入', () => {
  const cleared = transitionReviewCase(
    pendingCase,
    { action: 'clear', expectedVersion: 1 },
    new Date('2026-08-30T10:00:00.000Z'),
  )
  assert.equal(cleared.status, 'decided')
  assert.equal(cleared.outcome, 'cleared')
  assert.equal(cleared.closedAt, '2026-08-30T10:00:00.000Z')
  assert.equal(cleared.appealDeadlineAt, null)

  assert.throws(
    () =>
      transitionReviewCase(cleared, { action: 'submit_appeal', expectedVersion: 2 }, new Date('2026-08-30T11:00:00.000Z')),
    expectPolicyError('PROCTORING_REVIEW_STATE_CONFLICT'),
  )
  assert.throws(
    () =>
      transitionReviewCase(
        cleared,
        { action: 'request_information', expectedVersion: 2 },
        new Date('2026-08-30T11:00:00.000Z'),
      ),
    expectPolicyError('PROCTORING_REVIEW_STATE_CONFLICT'),
  )
})

test('违规案件可在期限内申诉，并由考务确认成立或驳回', () => {
  const decided = transitionReviewCase(
    pendingCase,
    { action: 'confirm_violation', expectedVersion: 1 },
    new Date('2026-08-30T10:00:00.000Z'),
  )
  const appealed = transitionReviewCase(
    decided,
    { action: 'submit_appeal', expectedVersion: 2 },
    new Date('2026-09-06T10:00:00.000Z'),
  )
  assert.equal(appealed.status, 'appeal_pending')
  assert.equal(appealed.version, 3)

  const upheld = transitionReviewCase(
    appealed,
    { action: 'resolve_appeal_upheld', expectedVersion: 3 },
    new Date('2026-09-06T11:00:00.000Z'),
  )
  assert.equal(upheld.status, 'appeal_resolved')
  assert.equal(upheld.outcome, 'cleared')
  assert.equal(upheld.closedAt, '2026-09-06T11:00:00.000Z')

  const rejected = transitionReviewCase(
    appealed,
    { action: 'resolve_appeal_rejected', expectedVersion: 3 },
    new Date('2026-09-06T11:00:00.000Z'),
  )
  assert.equal(rejected.status, 'appeal_resolved')
  assert.equal(rejected.outcome, 'violation_confirmed')
  assert.equal(rejected.closedAt, '2026-09-06T11:00:00.000Z')

  assert.throws(
    () =>
      transitionReviewCase(
        rejected,
        { action: 'resolve_appeal_upheld', expectedVersion: 4 },
        new Date('2026-09-06T12:00:00.000Z'),
      ),
    expectPolicyError('PROCTORING_REVIEW_STATE_CONFLICT'),
  )
})

test('超过七天申诉期限后拒绝提交', () => {
  const decided = transitionReviewCase(
    pendingCase,
    { action: 'confirm_violation', expectedVersion: 1 },
    new Date('2026-08-30T10:00:00.000Z'),
  )

  assert.throws(
    () =>
      transitionReviewCase(
        decided,
        { action: 'submit_appeal', expectedVersion: 2 },
        new Date('2026-09-06T10:00:00.001Z'),
      ),
    expectPolicyError('PROCTORING_REVIEW_APPEAL_EXPIRED'),
  )
})

test('乐观版本不一致时优先报告版本冲突', () => {
  assert.throws(
    () => transitionReviewCase(pendingCase, { action: 'clear', expectedVersion: 0 }),
    expectPolicyError('PROCTORING_REVIEW_VERSION_CONFLICT'),
  )
})

test('自由文本移除 C0/C1 控制字符、统一换行并保留可读内容', () => {
  assert.equal(normalizeReviewText('  第一行\u0000\r\n第二行\u0085  '), '第一行\n第二行')
  assert.equal(normalizeReviewText('设备短暂中断\t已恢复'), '设备短暂中断\t已恢复')
})

test('自由文本不能为空且最多一千个字符', () => {
  assert.throws(() => normalizeReviewText('\u0000\u0085  '), expectPolicyError('PROCTORING_REVIEW_TEXT_REQUIRED'))
  assert.throws(() => normalizeReviewText('测'.repeat(1001)), expectPolicyError('PROCTORING_REVIEW_TEXT_TOO_LONG'))
  assert.equal([...normalizeReviewText('😀'.repeat(1000))].length, 1000)
})

test('决定动作只能使用对应的服务端原因代码', () => {
  assert.equal(validateDecisionReason('request_information', 'CANDIDATE_EXPLANATION_REQUIRED'), 'CANDIDATE_EXPLANATION_REQUIRED')
  assert.equal(validateDecisionReason('clear', 'INSUFFICIENT_EVIDENCE'), 'INSUFFICIENT_EVIDENCE')
  assert.equal(validateDecisionReason('confirm_violation', 'MULTIPLE_PERSONS_CONFIRMED'), 'MULTIPLE_PERSONS_CONFIRMED')
  assert.equal(validateDecisionReason('resolve_appeal_upheld', 'APPEAL_EVIDENCE_ACCEPTED'), 'APPEAL_EVIDENCE_ACCEPTED')
  assert.equal(validateDecisionReason('resolve_appeal_rejected', 'APPEAL_EVIDENCE_REJECTED'), 'APPEAL_EVIDENCE_REJECTED')

  assert.throws(
    () => validateDecisionReason('clear', 'MULTIPLE_PERSONS_CONFIRMED'),
    expectPolicyError('PROCTORING_REVIEW_REASON_NOT_ALLOWED'),
  )
  assert.throws(
    () => validateDecisionReason('confirm_violation', 'UNKNOWN_REASON'),
    expectPolicyError('PROCTORING_REVIEW_REASON_NOT_ALLOWED'),
  )
})

test('申诉原因只接受首版白名单', () => {
  assert.equal(normalizeAppealReasonCode(' device_interruption '), 'DEVICE_INTERRUPTION')
  assert.equal(normalizeAppealReasonCode('OTHER'), 'OTHER')
  assert.throws(
    () => normalizeAppealReasonCode('PAYMENT_PROBLEM'),
    expectPolicyError('PROCTORING_REVIEW_APPEAL_REASON_INVALID'),
  )
})

test('写操作编号必须是规范 UUID 并统一为小写', () => {
  assert.equal(
    normalizeReviewUuid('81C75367-FB18-42F4-8B97-B8F5C36F8A0C', '决定编号'),
    '81c75367-fb18-42f4-8b97-b8f5c36f8a0c',
  )
  assert.throws(
    () => normalizeReviewUuid('not-a-uuid', '决定编号'),
    expectPolicyError('PROCTORING_REVIEW_UUID_INVALID'),
  )
})

test('同一语义请求不受对象键顺序影响，但保留数组顺序', () => {
  const first = reviewRequestDigest({ b: 2, a: { y: [2, 1], x: true } })
  const reordered = reviewRequestDigest({ a: { x: true, y: [2, 1] }, b: 2 })
  const changed = reviewRequestDigest({ a: { x: true, y: [1, 2] }, b: 2 })
  assert.equal(first, reordered)
  assert.notEqual(first, changed)
  assert.match(first, /^[0-9a-f]{64}$/)
})

test('CSV 单元格统一转义并阻断公式注入', () => {
  assert.equal(escapeCsvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"')
  assert.equal(escapeCsvCell('  +1+1'), '"  \'+1+1"')
  assert.equal(escapeCsvCell('普通,"文本"'), '"普通,""文本"""')
  assert.equal(escapeCsvCell(null), '""')
})
