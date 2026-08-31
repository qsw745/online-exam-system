import { createHash, randomUUID } from 'node:crypto'

import type { LifecycleHandler } from '../services/lifecycle-worker.service'
import { defaultLifecycleHandlerDatabase, requireAccountParent, type LifecycleHandlerDatabase } from './handler-support'

export const createRestrictGuardianConsentsHandler = (
  database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase,
): LifecycleHandler => ({
  stepCode: 'restrict_guardian_consents',
  category: 'PROCTORING_AND_IDENTITY',
  async planCount(context) {
    const parent = requireAccountParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        'SELECT COUNT(*) AS total FROM guardian_consents WHERE child_user_id=? OR guardian_user_id=?',
        [parent.userId, parent.userId],
      )
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    const parent = requireAccountParent(context)
    const afterId = Number(context.cursor?.afterId || 0)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        `SELECT id, expires_at FROM guardian_consents
          WHERE (child_user_id=? OR guardian_user_id=?) AND id>? ORDER BY id LIMIT ?`,
        [parent.userId, parent.userId, afterId, context.batchSize],
      )
      const consents = rows as Array<{ id: number; expires_at?: unknown }>
      let restrictedUntilMs = 0
      for (const consent of consents) {
        const expiresAt = consent.expires_at ? new Date(String(consent.expires_at)) : context.now
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= context.now) {
          await connection.query('DELETE FROM guardian_consents WHERE id=?', [consent.id])
        } else {
          await connection.query(
            `UPDATE guardian_consents
                SET child_user_id=NULL, guardian_user_id=NULL, evidence_json=NULL
              WHERE id=?`,
            [consent.id],
          )
          restrictedUntilMs = Math.max(restrictedUntilMs, expiresAt.getTime())
        }
      }
      const restrictedUntil = restrictedUntilMs > 0 ? new Date(restrictedUntilMs) : null
      if (restrictedUntil) {
        const digest = createHash('sha256').update(`${parent.requestId}:GUARDIAN_CONSENT`).digest('hex')
        await connection.query(
          `INSERT INTO data_retention_holds
            (hold_id, data_region, category_code, scope_type, scope_id, reason_code,
             legal_basis_reference, request_digest, expires_at)
           SELECT ?, ?, 'PROCTORING_AND_IDENTITY', 'USER_REQUEST', ?, 'POLICY_RETENTION',
                  '未成年人监护同意固化期限', ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM data_retention_holds
               WHERE scope_type='USER_REQUEST' AND scope_id=? AND category_code='PROCTORING_AND_IDENTITY'
                 AND released_at IS NULL AND expires_at>?
            )`,
          [randomUUID(), context.dataRegion, parent.requestId, digest, restrictedUntil, parent.requestId, context.now],
        )
      }
      const done = consents.length < context.batchSize
      return {
        processedCount: consents.length,
        nextCursor: done || consents.length === 0 ? null : { afterId: consents[consents.length - 1].id },
        done,
        restrictedRetentionUntil: restrictedUntil?.toISOString() ?? null,
      }
    })
  },
})
