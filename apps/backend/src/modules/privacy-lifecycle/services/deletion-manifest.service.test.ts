import assert from 'node:assert/strict'
import test from 'node:test'

import type { DataRegion } from '../domain/lifecycle.model'
import {
  FileDeletionManifestSink,
  MemoryDeletionManifestSink,
  createDeletionManifestStager,
  createManifestEntry,
  createSubjectDigest,
  replayDeletionManifest,
  type ManifestReplayDatabase,
} from './deletion-manifest.service'

const key = Buffer.alloc(32, 7)
const publicId = 'fa0d8c4e-4fd0-4f56-99aa-3f089d0e474a'

class MemoryRestoredDatabase implements ManifestReplayDatabase {
  users = [{ publicId, dataRegion: 'CN' as DataRegion }]

  async listSubjects(input: { dataRegion: DataRegion; afterPublicId: string | null; limit: number }) {
    const rows = this.users
      .filter(user => user.dataRegion === input.dataRegion && (!input.afterPublicId || user.publicId > input.afterPublicId))
      .sort((a, b) => a.publicId.localeCompare(b.publicId))
      .slice(0, input.limit)
    return rows.map(user => ({ publicId: user.publicId }))
  }

  async deleteSubjects(dataRegion: DataRegion, publicIds: readonly string[]) {
    const before = this.users.length
    this.users = this.users.filter(user => user.dataRegion !== dataRegion || !publicIds.includes(user.publicId))
    return before - this.users.length
  }
}

test('旧备份恢复后墓碑重放再次删除已注销主体且不暴露原编号', async () => {
  const sink = new MemoryDeletionManifestSink()
  await sink.append(createManifestEntry({
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    dataRegion: 'CN',
    publicId,
    key,
    keyVersion: 'v1',
    completedAt: new Date('2026-08-31T08:00:00.000Z'),
  }))
  const restored = new MemoryRestoredDatabase()
  const summary = await replayDeletionManifest(sink, restored, { v1: key })
  assert.equal(summary.deletedSubjects, 1)
  assert.equal(restored.users.length, 0)
  assert.doesNotMatch(JSON.stringify(await sink.list()), /fa0d8c4e/)

  const replay = await replayDeletionManifest(sink, restored, { v1: key })
  assert.equal(replay.deletedSubjects, 0)
})

test('错误墓碑密钥版本失败关闭且不会删除恢复数据', async () => {
  const sink = new MemoryDeletionManifestSink()
  await sink.append({
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    dataRegion: 'CN',
    subjectDigest: createSubjectDigest(key, publicId),
    keyVersion: 'v2',
    completedAt: '2026-08-31T08:00:00.000Z',
  })
  const restored = new MemoryRestoredDatabase()
  await assert.rejects(
    replayDeletionManifest(sink, restored, { v1: key }),
    (error: unknown) => (error as { code?: string }).code === 'LIFECYCLE_MANIFEST_KEY_VERSION_UNKNOWN',
  )
  assert.equal(restored.users.length, 1)
})

test('生产环境禁止文件墓碑接收器', () => {
  assert.throws(
    () => new FileDeletionManifestSink('/tmp/wenheng-manifest-test.jsonl', 'production'),
    (error: unknown) => (error as { code?: string }).code === 'LIFECYCLE_MANIFEST_FILE_FORBIDDEN',
  )
})

test('主库墓碑只写不可逆摘要而不写原主体编号', async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const stager = createDeletionManifestStager({ keyring: { v1: key } })
  await stager.stageFingerprint({
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    dataRegion: 'CN',
    publicId,
    completedAt: new Date('2026-08-31T08:00:00.000Z'),
    connection: {
      async query(sql, params = []) {
        calls.push({ sql, params })
        return [[], null]
      },
    },
  })
  assert.equal(calls.length, 1)
  assert.doesNotMatch(JSON.stringify(calls), /fa0d8c4e/)
  assert.match(JSON.stringify(calls), /[a-f0-9]{64}/)
})

test('账号删除事务预存加密最终通知并等待墓碑同步后投递', async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const stager = createDeletionManifestStager({ keyring: { v1: key }, outboxKeyring: { v1: key } })
  await stager.stageFingerprint({
    requestId: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
    dataRegion: 'CN',
    publicId,
    notificationEmail: 'user@example.com',
    completedAt: new Date('2026-08-31T08:00:00.000Z'),
    connection: {
      async query(sql, params = []) {
        calls.push({ sql, params })
        if (sql.includes('MAX(expires_at)')) return [[{ restricted_retention_until: null }], null]
        return [[], null]
      },
    },
  })
  const outbox = calls.find(call => call.sql.includes('transactional_outbox'))
  assert.ok(outbox)
  assert.match(outbox.sql, /'BLOCKED'/)
  assert.doesNotMatch(JSON.stringify(calls), /user@example\.com/)
})
