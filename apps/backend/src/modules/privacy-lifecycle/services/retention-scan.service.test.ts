import assert from 'node:assert/strict'
import test from 'node:test'

import { MemoryLifecycleMetrics } from './lifecycle-observability'
import { createRetentionScanHandlers } from '../handlers/retention-scan.handlers'
import {
  dueDeletionReminder,
  isRetentionEligible,
  runRetentionScanOnce,
  type RetentionScanCreateInput,
  type RetentionScanRepositoryContract,
  type RetentionScanRun,
} from './retention-scan.service'

class MemoryRetentionScanRepository implements RetentionScanRepositoryContract {
  readonly runs = new Map<string, RetentionScanRun>()

  async createOrResume(input: RetentionScanCreateInput): Promise<RetentionScanRun> {
    const key = [input.dataRegion, input.category, input.windowStart.toISOString(), input.windowEnd.toISOString()].join(':')
    const existing = this.runs.get(key)
    if (existing) return structuredClone(existing)
    const run: RetentionScanRun = {
      scanRunId: 'a132689c-4a5d-42a2-86c5-3661e62d4d1f',
      dataRegion: input.dataRegion,
      category: input.category,
      windowStart: input.windowStart.toISOString(),
      windowEnd: input.windowEnd.toISOString(),
      status: 'PENDING',
      resumed: false,
    }
    this.runs.set(key, run)
    return structuredClone(run)
  }
}

const windowInput = {
  dataRegion: 'CN' as const,
  category: 'EXAM_ARCHIVE' as const,
  windowStart: new Date('2026-08-31T00:00:00.000Z'),
  windowEnd: new Date('2026-09-01T00:00:00.000Z'),
  now: new Date('2026-08-31T08:00:00.000Z'),
}

test('重复调度同一区域类别窗口只继续同一次扫描', async () => {
  const repository = new MemoryRetentionScanRepository()
  const metrics = new MemoryLifecycleMetrics()
  const first = await runRetentionScanOnce({ ...windowInput, repository, metrics })
  const second = await runRetentionScanOnce({ ...windowInput, repository, metrics })
  assert.equal(second.scanRunId, first.scanRunId)
  assert.equal(repository.runs.size, 1)
})

test('未到期限和有效冻结不清理，冻结过期后重新符合清理条件', () => {
  const now = new Date('2026-08-31T08:00:00.000Z')
  assert.equal(isRetentionEligible({ retainUntil: new Date('2026-09-01T00:00:00.000Z'), now }), false)
  assert.equal(isRetentionEligible({
    retainUntil: new Date('2026-08-30T00:00:00.000Z'),
    activeHoldUntil: new Date('2026-09-02T00:00:00.000Z'),
    now,
  }), false)
  assert.equal(isRetentionEligible({
    retainUntil: new Date('2026-08-30T00:00:00.000Z'),
    activeHoldUntil: new Date('2026-08-31T07:59:59.000Z'),
    now,
  }), true)
})

test('七天和二十四小时宽限提醒使用确定性唯一消息键', () => {
  const scheduledFor = new Date('2026-09-30T08:00:00.000Z')
  assert.deepEqual(dueDeletionReminder({
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    scheduledFor,
    now: new Date('2026-09-23T08:30:00.000Z'),
  }), {
    messageType: 'DELETION_GRACE_7D',
    messageKey: 'deletion-grace-7d:b132689c-4a5d-42a2-86c5-3661e62d4d1f',
  })
  assert.deepEqual(dueDeletionReminder({
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    scheduledFor,
    now: new Date('2026-09-29T08:30:00.000Z'),
  }), {
    messageType: 'DELETION_GRACE_24H',
    messageKey: 'deletion-grace-24h:b132689c-4a5d-42a2-86c5-3661e62d4d1f',
  })
})

test('七类期限扫描都有固定 Worker 处理器且不接受动态代码', () => {
  const database = {
    async withTransaction<T>(operation: (connection: any) => Promise<T>): Promise<T> {
      return operation({ async query() { return [[], null] } })
    },
  }
  const handlers = createRetentionScanHandlers({ database, outboxKeyring: { v1: Buffer.alloc(32, 3) } })
  assert.deepEqual(handlers.map(handler => handler.stepCode).sort(), [
    'retention_deletion_reminders',
    'retention_exam_archive',
    'retention_face_credentials',
    'retention_outbox_purge',
    'retention_proctoring_identity',
    'retention_receipts_tombstones',
    'retention_security_logs',
  ])
})
