import type { DeletionManifestEntry, DeletionManifestSink } from '../services/deletion-manifest.service'
import type { LifecycleHandler } from '../services/lifecycle-worker.service'
import type { LifecycleHandlerDatabase } from './handler-support'

const requireDeletionRequest = (parent: Parameters<LifecycleHandler['executeBatch']>[0]['parent']) => {
  if (parent.kind !== 'ACCOUNT_DELETION') {
    throw Object.assign(new Error('墓碑同步只接受账号注销任务'), {
      code: 'LIFECYCLE_PARENT_INVALID',
      recoverable: false,
    })
  }
  return parent
}

const asIso = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('墓碑完成时间无效'), {
      code: 'LIFECYCLE_MANIFEST_INVALID',
      recoverable: false,
    })
  }
  return date.toISOString()
}

export function createSyncDeletionManifestHandler(input: {
  database: LifecycleHandlerDatabase
  sink: DeletionManifestSink
}): LifecycleHandler {
  return {
    stepCode: 'sync_deletion_manifest',
    category: 'RECEIPT_AND_TOMBSTONE',
    async planCount(context) {
      const parent = requireDeletionRequest(context.parent)
      return input.database.withTransaction(async connection => {
        const [rows] = await connection.query(
          `SELECT COUNT(*) AS total
             FROM data_deletion_tombstones
            WHERE request_id=? AND sync_status<>'SYNCED'`,
          [parent.requestId],
        )
        return Number((rows as any[])?.[0]?.total || 0)
      })
    },
    async executeBatch(context) {
      const parent = requireDeletionRequest(context.parent)
      const row = await input.database.withTransaction(async connection => {
        const [rows] = await connection.query(
          `SELECT tombstone_id, request_id, data_region, subject_digest, key_version,
                  completed_at, sync_status
             FROM data_deletion_tombstones
            WHERE request_id=?
            LIMIT 1 FOR UPDATE`,
          [parent.requestId],
        )
        return (rows as any[])?.[0] ?? null
      })
      if (!row) {
        throw Object.assign(new Error('账号删除后缺少墓碑'), {
          code: 'LIFECYCLE_MANIFEST_MISSING',
          recoverable: false,
        })
      }
      if (String(row.sync_status) === 'SYNCED') {
        return { processedCount: 0, nextCursor: null, done: true }
      }

      const entry: DeletionManifestEntry = {
        requestId: String(row.request_id),
        dataRegion: row.data_region,
        subjectDigest: String(row.subject_digest),
        keyVersion: String(row.key_version),
        completedAt: asIso(row.completed_at),
      }
      await input.sink.append(entry)

      await input.database.withTransaction(async connection => {
        const [result] = await connection.query(
          `UPDATE data_deletion_tombstones
              SET sync_status='SYNCED', synced_at=?, attempt_count=attempt_count+1,
                  next_attempt_at=NULL
            WHERE tombstone_id=? AND sync_status<>'SYNCED'`,
          [context.now, row.tombstone_id],
        )
        if (Number((result as { affectedRows?: unknown }).affectedRows || 0) !== 1) {
          const [current] = await connection.query(
            'SELECT sync_status FROM data_deletion_tombstones WHERE tombstone_id=? LIMIT 1',
            [row.tombstone_id],
          )
          if (String((current as any[])?.[0]?.sync_status) !== 'SYNCED') {
            throw Object.assign(new Error('墓碑同步状态冲突'), { code: 'LIFECYCLE_MANIFEST_SYNC_CONFLICT' })
          }
        }
        await connection.query(
          `UPDATE transactional_outbox
              SET status='PENDING', next_attempt_at=?, updated_at=?
            WHERE message_key=? AND status='BLOCKED'`,
          [context.now, context.now, `deletion-final:${parent.requestId}`],
        )
      })
      return { processedCount: 1, nextCursor: null, done: true }
    },
  }
}
