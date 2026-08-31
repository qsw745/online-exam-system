import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACCOUNT_DELETION_CONFIRMATION,
  buildAccountDeletionPreview,
  isValidDeletionConfirmation,
} from './account-deletion.policy'

test('注销申请使用明确确认词，不能模糊匹配', () => {
  assert.equal(isValidDeletionConfirmation(ACCOUNT_DELETION_CONFIRMATION), true)
  assert.equal(isValidDeletionConfirmation('删除账号'), false)
  assert.equal(isValidDeletionConfirmation(` ${ACCOUNT_DELETION_CONFIRMATION} `), false)
})

test('注销预览区分申请、计划删除和依法保留数据', () => {
  const now = new Date('2026-08-30T00:00:00.000Z')
  const preview = buildAccountDeletionPreview(now)

  assert.equal(preview.status, 'NOT_REQUESTED')
  assert.equal(preview.scheduledFor, '2026-09-29T00:00:00.000Z')
  assert.deepEqual(preview.modes, [
    {
      mode: 'IMMEDIATE',
      scheduledFor: '2026-08-30T00:00:00.000Z',
      cancellable: false,
      targetCompletionHours: 24,
    },
    {
      mode: 'GRACE_PERIOD',
      scheduledFor: '2026-09-29T00:00:00.000Z',
      cancellable: true,
      targetCompletionHours: null,
    },
  ])
  assert.ok(preview.deleteOrAnonymize.length > 0)
  assert.ok(preview.conditionalRetention.length > 0)
  assert.match(preview.disclaimer, /不等于.*物理删除/)
})
