import { randomUUID } from 'node:crypto'

import { encryptOutboxValue, type OutboxKeyring } from '../domain/outbox-crypto'
import { dueDeletionReminder } from '../services/retention-scan.service'
import type {
  LifecycleBatchResult,
  LifecycleHandler,
  LifecycleHandlerContext,
  LifecycleTransaction,
} from '../services/lifecycle-worker.service'
import type { LifecycleHandlerDatabase } from './handler-support'

const requireScanParent = (context: LifecycleHandlerContext) => {
  if (context.parent.kind !== 'RETENTION_SCAN') {
    throw Object.assign(new Error('期限处理器只接受扫描任务'), {
      code: 'LIFECYCLE_PARENT_INVALID',
      recoverable: false,
    })
  }
  return context.parent
}

const affectedRows = (result: unknown): number => Number((result as { affectedRows?: unknown })?.affectedRows || 0)
const placeholders = (values: readonly unknown[]): string => values.map(() => '?').join(',')

const createSimpleRetentionHandler = (input: {
  stepCode: string
  category: LifecycleHandler['category']
  database: LifecycleHandlerDatabase
  countSql: string
  executeSql: string
}): LifecycleHandler => ({
  stepCode: input.stepCode,
  category: input.category,
  async planCount(context) {
    requireScanParent(context)
    return input.database.withTransaction(async connection => {
      const [rows] = await connection.query(input.countSql, [context.dataRegion, context.now])
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    requireScanParent(context)
    return input.database.withTransaction(async connection => {
      const [result] = await connection.query(input.executeSql, [context.now, context.dataRegion, context.now, context.batchSize])
      const processedCount = affectedRows(result)
      return { processedCount, nextCursor: null, done: processedCount < context.batchSize }
    })
  },
})

const createFaceRetentionHandler = (database: LifecycleHandlerDatabase): LifecycleHandler => ({
  stepCode: 'retention_face_credentials',
  category: 'FACE_CREDENTIALS',
  async planCount(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS total FROM face_credentials fc
          JOIN users u ON u.id=fc.user_id
         WHERE u.data_region=? AND u.deletion_status<>'ACTIVE'`,
        [context.dataRegion],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    requireScanParent(context)
    const afterId = Number(context.cursor?.afterId || 0)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT fc.id FROM face_credentials fc
          JOIN users u ON u.id=fc.user_id
         WHERE u.data_region=? AND u.deletion_status<>'ACTIVE' AND fc.id>?
         ORDER BY fc.id LIMIT ?`,
        [context.dataRegion, afterId, context.batchSize],
      )
      const ids = (rows as Array<{ id: number }>).map(row => Number(row.id))
      if (ids.length === 0) return { processedCount: 0, nextCursor: null, done: true }
      const [result] = await connection.query(
        `DELETE FROM face_credentials WHERE id IN (${placeholders(ids)})`,
        ids,
      )
      const processedCount = affectedRows(result)
      return {
        processedCount,
        nextCursor: ids.length < context.batchSize ? null : { afterId: ids[ids.length - 1]! },
        done: ids.length < context.batchSize,
      }
    })
  },
})

const createSecurityLogRetentionHandler = (database: LifecycleHandlerDatabase): LifecycleHandler => ({
  stepCode: 'retention_security_logs',
  category: 'SECURITY_LOGS',
  async planCount(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS total FROM logs l JOIN users u ON u.id=l.user_id
          WHERE u.data_region=? AND l.retain_until<=?`,
        [context.dataRegion, context.now],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    requireScanParent(context)
    const afterId = Number(context.cursor?.afterId || 0)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT l.id FROM logs l JOIN users u ON u.id=l.user_id
          WHERE u.data_region=? AND l.retain_until<=? AND l.id>?
          ORDER BY l.id LIMIT ?`,
        [context.dataRegion, context.now, afterId, context.batchSize],
      )
      const ids = (rows as Array<{ id: number }>).map(row => Number(row.id))
      if (ids.length === 0) return { processedCount: 0, nextCursor: null, done: true }
      const [result] = await connection.query(
        `UPDATE logs SET user_id=NULL, message='已到期安全事件', details=NULL,
                         ip_address=NULL, user_agent=NULL
          WHERE id IN (${placeholders(ids)})`,
        ids,
      )
      return {
        processedCount: affectedRows(result),
        nextCursor: ids.length < context.batchSize ? null : { afterId: ids[ids.length - 1]! },
        done: ids.length < context.batchSize,
      }
    })
  },
})

const createExamArchiveRetentionHandler = (database: LifecycleHandlerDatabase): LifecycleHandler => ({
  stepCode: 'retention_exam_archive',
  category: 'EXAM_ARCHIVE',
  async planCount(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        'SELECT COUNT(*) AS total FROM anonymous_exam_subjects WHERE data_region=? AND retain_until<=?',
        [context.dataRegion, context.now],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context): Promise<LifecycleBatchResult> {
    requireScanParent(context)
    const afterId = String(context.cursor?.afterId || '')
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT anonymous_subject_id FROM anonymous_exam_subjects
          WHERE data_region=? AND retain_until<=? AND anonymous_subject_id>?
          ORDER BY anonymous_subject_id LIMIT ?`,
        [context.dataRegion, context.now, afterId, context.batchSize],
      )
      const ids = (rows as Array<{ anonymous_subject_id: string }>).map(row => String(row.anonymous_subject_id))
      if (ids.length === 0) return { processedCount: 0, nextCursor: null, done: true }
      const marks = placeholders(ids)
      let processedCount = 0
      for (const sql of [
        `DELETE FROM answer_records WHERE anonymous_subject_id IN (${marks}) AND retain_until<=?`,
        `DELETE FROM exam_results WHERE anonymous_subject_id IN (${marks}) AND retain_until<=?`,
      ]) {
        const [result] = await connection.query(sql, [...ids, context.now])
        processedCount += affectedRows(result)
      }
      await connection.query(
        `DELETE aes FROM anonymous_exam_subjects aes
          WHERE aes.anonymous_subject_id IN (${marks})
            AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.anonymous_subject_id=aes.anonymous_subject_id)
            AND NOT EXISTS (SELECT 1 FROM answer_records ar WHERE ar.anonymous_subject_id=aes.anonymous_subject_id)
            AND NOT EXISTS (SELECT 1 FROM proctoring_sessions ps WHERE ps.anonymous_subject_id=aes.anonymous_subject_id)`,
        ids,
      )
      const lastId = ids[ids.length - 1]!
      return {
        processedCount,
        nextCursor: ids.length < context.batchSize ? null : { afterId: lastId },
        done: ids.length < context.batchSize,
      }
    })
  },
})

const deleteProctoringBatch = async (
  connection: LifecycleTransaction,
  sessionIds: readonly string[],
  now: Date,
): Promise<number> => {
  const marks = placeholders(sessionIds)
  let count = 0
  for (const sql of [
    `DELETE FROM proctoring_review_decisions WHERE case_id IN (SELECT case_id FROM proctoring_review_cases WHERE session_id IN (${marks}) AND retain_until<=?)`,
    `DELETE FROM proctoring_review_messages WHERE case_id IN (SELECT case_id FROM proctoring_review_cases WHERE session_id IN (${marks}) AND retain_until<=?)`,
    `DELETE FROM proctoring_review_appeals WHERE case_id IN (SELECT case_id FROM proctoring_review_cases WHERE session_id IN (${marks}) AND retain_until<=?)`,
    `DELETE FROM proctoring_review_cases WHERE session_id IN (${marks}) AND retain_until<=?`,
    `DELETE FROM proctoring_identity_checks WHERE session_id IN (${marks}) AND retain_until<=?`,
    `DELETE FROM proctoring_events WHERE session_id IN (${marks}) AND retain_until<=?`,
    `DELETE FROM proctoring_sessions WHERE session_id IN (${marks}) AND retain_until<=?`,
  ]) {
    const [result] = await connection.query(sql, [...sessionIds, now])
    count += affectedRows(result)
  }
  return count
}

const createProctoringRetentionHandler = (database: LifecycleHandlerDatabase): LifecycleHandler => ({
  stepCode: 'retention_proctoring_identity',
  category: 'PROCTORING_AND_IDENTITY',
  async planCount(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        'SELECT COUNT(*) AS total FROM proctoring_sessions WHERE data_region=? AND retain_until<=?',
        [context.dataRegion, context.now],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    requireScanParent(context)
    const afterId = String(context.cursor?.afterId || '')
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT session_id FROM proctoring_sessions
          WHERE data_region=? AND retain_until<=? AND session_id>?
          ORDER BY session_id LIMIT ?`,
        [context.dataRegion, context.now, afterId, context.batchSize],
      )
      const ids = (rows as Array<{ session_id: string }>).map(row => String(row.session_id))
      if (ids.length === 0) return { processedCount: 0, nextCursor: null, done: true }
      const processedCount = await deleteProctoringBatch(connection, ids, context.now)
      return {
        processedCount,
        nextCursor: ids.length < context.batchSize ? null : { afterId: ids[ids.length - 1]! },
        done: ids.length < context.batchSize,
      }
    })
  },
})

const createReminderHandler = (
  database: LifecycleHandlerDatabase,
  outboxKeyring: OutboxKeyring,
): LifecycleHandler => ({
  stepCode: 'retention_deletion_reminders',
  category: 'RECEIPT_AND_TOMBSTONE',
  async planCount(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS total FROM account_deletion_requests adr JOIN users u ON u.id=adr.user_id
          WHERE adr.data_region=? AND adr.deletion_mode='GRACE_PERIOD'
            AND adr.execution_status IN ('REQUESTED','SCHEDULED')
            AND adr.scheduled_for>? AND adr.scheduled_for<=DATE_ADD(?, INTERVAL 7 DAY)`,
        [context.dataRegion, context.now, context.now],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    requireScanParent(context)
    const key = outboxKeyring.v1
    if (!key) throw Object.assign(new Error('提醒消息箱密钥未配置'), { code: 'LIFECYCLE_OUTBOX_KEY_REQUIRED' })
    const afterId = Number(context.cursor?.afterId || 0)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT adr.id, adr.request_id, adr.scheduled_for, u.email
           FROM account_deletion_requests adr JOIN users u ON u.id=adr.user_id
          WHERE adr.data_region=? AND adr.deletion_mode='GRACE_PERIOD'
            AND adr.execution_status IN ('REQUESTED','SCHEDULED') AND adr.id>?
            AND adr.scheduled_for>? AND adr.scheduled_for<=DATE_ADD(?, INTERVAL 7 DAY)
          ORDER BY adr.id LIMIT ?`,
        [context.dataRegion, afterId, context.now, context.now, context.batchSize],
      )
      let processedCount = 0
      for (const row of rows as any[]) {
        const reminder = dueDeletionReminder({
          requestId: String(row.request_id),
          scheduledFor: new Date(row.scheduled_for),
          now: context.now,
        })
        if (!reminder) continue
        const [result] = await connection.query(
          `INSERT IGNORE INTO transactional_outbox
            (message_id, message_key, request_id, data_region, message_type, status,
             recipient_envelope_json, payload_envelope_json, expires_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
          [
            randomUUID(), reminder.messageKey, row.request_id, context.dataRegion, reminder.messageType,
            JSON.stringify(encryptOutboxValue(key, String(row.email))),
            JSON.stringify(encryptOutboxValue(key, JSON.stringify({
              status: 'SCHEDULED', scheduledFor: new Date(row.scheduled_for).toISOString(),
            }))),
            new Date(context.now.getTime() + 7 * 86_400_000),
          ],
        )
        processedCount += affectedRows(result)
      }
      const list = rows as any[]
      return {
        processedCount,
        nextCursor: list.length < context.batchSize ? null : { afterId: Number(list[list.length - 1]!.id) },
        done: list.length < context.batchSize,
      }
    })
  },
})

const createReceiptRetentionHandler = (database: LifecycleHandlerDatabase): LifecycleHandler => ({
  stepCode: 'retention_receipts_tombstones',
  category: 'RECEIPT_AND_TOMBSTONE',
  async planCount(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT
           (SELECT COUNT(*) FROM data_deletion_receipts WHERE data_region=? AND retain_until<=?)
           + (SELECT COUNT(*) FROM data_deletion_tombstones
               WHERE data_region=? AND retain_until<=? AND sync_status='SYNCED') AS total`,
        [context.dataRegion, context.now, context.dataRegion, context.now],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    requireScanParent(context)
    return database.withTransaction(async connection => {
      let processedCount = 0
      let done = true
      for (const sql of [
        'DELETE FROM data_deletion_receipts WHERE data_region=? AND retain_until<=? LIMIT ?',
        `DELETE FROM data_deletion_tombstones
          WHERE data_region=? AND retain_until<=? AND sync_status='SYNCED' LIMIT ?`,
      ]) {
        const [result] = await connection.query(sql, [context.dataRegion, context.now, context.batchSize])
        const count = affectedRows(result)
        processedCount += count
        if (count >= context.batchSize) done = false
      }
      return { processedCount, nextCursor: null, done }
    })
  },
})

export function createRetentionScanHandlers(input: {
  database: LifecycleHandlerDatabase
  outboxKeyring: OutboxKeyring
}): readonly LifecycleHandler[] {
  return [
    createFaceRetentionHandler(input.database),
    createExamArchiveRetentionHandler(input.database),
    createProctoringRetentionHandler(input.database),
    createSecurityLogRetentionHandler(input.database),
    createReceiptRetentionHandler(input.database),
    createSimpleRetentionHandler({
      stepCode: 'retention_outbox_purge',
      category: 'RECEIPT_AND_TOMBSTONE',
      database: input.database,
      countSql: `SELECT COUNT(*) AS total FROM transactional_outbox
                  WHERE data_region=? AND expires_at<=? AND status NOT IN ('SENT','EXPIRED')`,
      executeSql: `UPDATE transactional_outbox
                      SET status='EXPIRED', recipient_envelope_json=NULL, payload_envelope_json=NULL,
                          lease_owner=NULL, lease_expires_at=NULL, updated_at=?
                    WHERE data_region=? AND expires_at<=? AND status NOT IN ('SENT','EXPIRED') LIMIT ?`,
    }),
    createReminderHandler(input.database, input.outboxKeyring),
  ]
}
