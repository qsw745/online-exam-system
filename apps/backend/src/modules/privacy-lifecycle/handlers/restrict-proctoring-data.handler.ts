import { createHash, randomUUID } from 'node:crypto'

import type { LifecycleHandler } from '../services/lifecycle-worker.service'
import { defaultLifecycleHandlerDatabase, requireAccountParent, type LifecycleHandlerDatabase } from './handler-support'

export const createRestrictProctoringDataHandler = (input: {
  database?: LifecycleHandlerDatabase
  uuid?: () => string
} = {}): LifecycleHandler => {
  const database = input.database ?? defaultLifecycleHandlerDatabase
  const uuid = input.uuid ?? randomUUID
  return {
    stepCode: 'restrict_proctoring_data',
    category: 'PROCTORING_AND_IDENTITY',
    async planCount(context) {
      const parent = requireAccountParent(context)
      return database.withTransaction(async connection => {
        const [rows] = await connection.query('SELECT COUNT(*) AS total FROM proctoring_sessions WHERE user_id=?', [parent.userId])
        return Number((rows as any[])?.[0]?.total || 0)
      })
    },
    async executeBatch(context) {
      const parent = requireAccountParent(context)
      const afterId = Number(context.cursor?.afterId || 0)
      return database.withTransaction(async connection => {
        const [rows] = await connection.query(
          `SELECT id, session_id, retain_until FROM proctoring_sessions
            WHERE user_id=? AND id>? ORDER BY id LIMIT ?`,
          [parent.userId, afterId, context.batchSize],
        )
        const sessions = rows as Array<{ id: number; session_id: string; retain_until?: unknown }>
        let restrictedRetentionUntilMs = 0
        for (const session of sessions) {
          const retainUntil = session.retain_until ? new Date(String(session.retain_until)) : context.now
          if (Number.isNaN(retainUntil.getTime()) || retainUntil <= context.now) {
            await connection.query('DELETE FROM proctoring_events WHERE session_id=?', [session.session_id])
            await connection.query('DELETE FROM proctoring_identity_checks WHERE session_id=?', [session.session_id])
            await connection.query('DELETE FROM proctoring_review_cases WHERE session_id=?', [session.session_id])
            await connection.query('DELETE FROM proctoring_sessions WHERE session_id=? AND user_id=?', [session.session_id, parent.userId])
            continue
          }
          const anonymousSubjectId = uuid()
          await connection.query(
            `INSERT INTO anonymous_exam_subjects
              (anonymous_subject_id, data_region, display_label, retain_until)
             VALUES (?, ?, '已注销考生', ?)`,
            [anonymousSubjectId, context.dataRegion, retainUntil],
          )
          for (const table of ['proctoring_events', 'proctoring_identity_checks', 'proctoring_review_cases'] as const) {
            await connection.query(
              `UPDATE ${table} SET user_id=NULL, anonymous_subject_id=? WHERE session_id=?`,
              [anonymousSubjectId, session.session_id],
            )
          }
          await connection.query(
            'UPDATE proctoring_sessions SET user_id=NULL, anonymous_subject_id=? WHERE session_id=? AND user_id=?',
            [anonymousSubjectId, session.session_id, parent.userId],
          )
          await connection.query('UPDATE proctoring_consents SET user_id=NULL WHERE attempt_id=(SELECT attempt_id FROM proctoring_sessions WHERE session_id=?)', [session.session_id])
          restrictedRetentionUntilMs = Math.max(restrictedRetentionUntilMs, retainUntil.getTime())
        }
        const restrictedRetentionUntil = restrictedRetentionUntilMs > 0 ? new Date(restrictedRetentionUntilMs) : null
        if (restrictedRetentionUntil) {
          const requestDigest = createHash('sha256').update(`${parent.requestId}:PROCTORING_AND_IDENTITY`).digest('hex')
          await connection.query(
            `INSERT INTO data_retention_holds
              (hold_id, data_region, category_code, scope_type, scope_id, reason_code,
               legal_basis_reference, request_digest, expires_at)
             SELECT ?, ?, 'PROCTORING_AND_IDENTITY', 'USER_REQUEST', ?, 'POLICY_RETENTION',
                    '固化监考与身份核验期限', ?, ?
              WHERE NOT EXISTS (
                SELECT 1 FROM data_retention_holds
                 WHERE scope_type='USER_REQUEST' AND scope_id=? AND category_code='PROCTORING_AND_IDENTITY'
                   AND released_at IS NULL AND expires_at>?
              )`,
            [randomUUID(), context.dataRegion, parent.requestId, requestDigest, restrictedRetentionUntil, parent.requestId, context.now],
          )
        }
        const done = sessions.length < context.batchSize
        return {
          processedCount: sessions.length,
          nextCursor: done || sessions.length === 0 ? null : { afterId: sessions[sessions.length - 1].id },
          done,
          restrictedRetentionUntil: restrictedRetentionUntil?.toISOString() ?? null,
        }
      })
    },
  }
}
