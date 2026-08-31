import assert from 'node:assert/strict'
import test from 'node:test'

import { ACCOUNT_DELETION_STEPS } from '@/modules/account/domain/account-deletion.model'
import type { LifecycleHandlerContext, LifecycleTransaction } from '../services/lifecycle-worker.service'
import { createAnonymizeExamArchiveHandler } from './anonymize-exam-archive.handler'
import {
  assertNoIdentityToAnonymousLink,
  createDeleteAccountHandler,
  type DeletionManifestStager,
} from './delete-account.handler'
import { createLifecycleHandlerMap } from './index'
import { createSyncDeletionManifestHandler } from './sync-deletion-manifest.handler'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const context = (): LifecycleHandlerContext => ({
  parent: {
    kind: 'ACCOUNT_DELETION',
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    userId: 7,
  },
  dataRegion: 'CN',
  policySnapshot: null,
  cursor: null,
  batchSize: 100,
  now: new Date('2026-08-31T08:00:00.000Z'),
})

class ScriptedDatabase {
  readonly calls: Array<{ sql: string; params: unknown[] }> = []
  readonly anonymousSubjects: string[] = []
  examRows = [
    { id: 11, retain_until: new Date('2027-08-31T08:00:00.000Z') },
    { id: 12, retain_until: new Date('2027-08-31T08:00:00.000Z') },
  ]

  async withTransaction<T>(operation: (connection: LifecycleTransaction) => Promise<T>): Promise<T> {
    return operation(this)
  }

  async query(sql: string, params: unknown[] = []): Promise<[any, unknown]> {
    this.calls.push({ sql, params })
    if (sql.includes('COUNT(*) AS total') && sql.includes('exam_results')) return [[{ total: this.examRows.length }], null]
    if (sql.includes('SELECT id, retain_until') && sql.includes('exam_results')) {
      const rows = this.examRows
      this.examRows = []
      return [rows, null]
    }
    if (sql.includes('INSERT INTO anonymous_exam_subjects')) {
      this.anonymousSubjects.push(String(params[0]))
      return [{ affectedRows: 1 }, null]
    }
    return [{ affectedRows: 1 }, null]
  }
}

test('考试档案逐记录迁移到随机匿名主体并清空所有原用户列', async () => {
  const database = new ScriptedDatabase()
  const handler = createAnonymizeExamArchiveHandler({ database })
  const first = await handler.executeBatch(context())
  assert.equal(first.done, true)
  assert.equal(first.processedCount, 2)
  assert.equal(database.anonymousSubjects.length, 2)
  assert.equal(new Set(database.anonymousSubjects).size, 2)
  assert.equal(database.anonymousSubjects.every(value => UUID_RE.test(value)), true)

  const archiveUpdates = database.calls.filter(call => /UPDATE (exam_results|answer_records|proctoring_)/.test(call.sql))
  assert.equal(archiveUpdates.length > 0, true)
  assert.equal(archiveUpdates.every(call => call.sql.includes('user_id=NULL')), true)

  const second = await handler.executeBatch(context())
  assert.equal(second.processedCount, 0)
  assert.equal(database.anonymousSubjects.length, 2)
})

test('处理器注册表与注销步骤一一对应且不接受动态步骤名', () => {
  const handlers = createLifecycleHandlerMap({
    database: new ScriptedDatabase(),
    manifest: { async stageFingerprint() { throw Object.assign(new Error('墓碑尚未接入'), { code: 'LIFECYCLE_MANIFEST_NOT_CONFIGURED' }) } },
  })
  assert.deepEqual([...handlers.keys()].sort(), ACCOUNT_DELETION_STEPS.map(step => step.stepCode).sort())
  for (const [stepCode, handler] of handlers) assert.equal(handler.stepCode, stepCode)
})

test('最终账号删除要求前置步骤、无身份反向关联并先暂存墓碑', async () => {
  const calls: string[] = []
  const database = {
    async withTransaction<T>(operation: (connection: LifecycleTransaction) => Promise<T>): Promise<T> {
      return operation(this)
    },
    async query(sql: string): Promise<[any, unknown]> {
      calls.push(sql)
      if (sql.includes('incomplete_count')) return [[{ incomplete_count: 0 }], null]
      if (sql.includes('identity_link_count')) return [[{ identity_link_count: 0 }], null]
      if (sql.includes('SELECT public_id')) return [[{ public_id: 'fa0d8c4e-4fd0-4f56-99aa-3f089d0e474a' }], null]
      if (sql.includes('SELECT user_id')) return [[{ user_id: null }], null]
      return [{ affectedRows: 1 }, null]
    },
  }
  const manifest: DeletionManifestStager = {
    async stageFingerprint(input) {
      calls.push(`manifest:${input.publicId}`)
    },
  }
  const result = await createDeleteAccountHandler({ database, manifest }).executeBatch(context())
  assert.equal(result.done, true)
  const manifestIndex = calls.findIndex(value => value.startsWith('manifest:'))
  const deleteIndex = calls.findIndex(value => value.includes('DELETE FROM users'))
  assert.equal(manifestIndex >= 0 && manifestIndex < deleteIndex, true)
})

test('存在原身份到匿名主体关联时失败关闭', async () => {
  const connection = {
    async query(): Promise<[any, unknown]> {
      return [[{ identity_link_count: 1 }], null]
    },
  }
  await assert.rejects(
    assertNoIdentityToAnonymousLink(connection, 'b132689c-4a5d-42a2-86c5-3661e62d4d1f'),
    (error: any) => error.code === 'LIFECYCLE_IDENTITY_LINK_REMAINS',
  )
})

test('外部墓碑接收器确认前同步步骤不能完成', async () => {
  const syncContext: LifecycleHandlerContext = {
    ...context(),
    parent: { kind: 'ACCOUNT_DELETION', requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f', userId: null },
  }
  let synced = false
  const database = {
    async withTransaction<T>(operation: (connection: LifecycleTransaction) => Promise<T>): Promise<T> {
      return operation(this)
    },
    async query(sql: string): Promise<[any, unknown]> {
      if (sql.includes('SELECT tombstone_id')) {
        return [[{
          tombstone_id: 'a132689c-4a5d-42a2-86c5-3661e62d4d1f',
          request_id: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
          data_region: 'CN',
          subject_digest: 'a'.repeat(64),
          key_version: 'v1',
          completed_at: new Date('2026-08-31T08:00:00.000Z'),
          sync_status: synced ? 'SYNCED' : 'PENDING',
        }], null]
      }
      if (sql.includes("SET sync_status='SYNCED'")) synced = true
      return [{ affectedRows: 1 }, null]
    },
  }
  const failing = createSyncDeletionManifestHandler({
    database,
    sink: { async append() { throw new Error('receiver unavailable') }, async list() { return { entries: [], nextCursor: null } } },
  })
  await assert.rejects(() => failing.executeBatch(syncContext))
  assert.equal(synced, false)

  const handler = createSyncDeletionManifestHandler({
    database,
    sink: { async append() {}, async list() { return { entries: [], nextCursor: null } } },
  })
  const result = await handler.executeBatch(syncContext)
  assert.equal(result.done, true)
  assert.equal(synced, true)
})
