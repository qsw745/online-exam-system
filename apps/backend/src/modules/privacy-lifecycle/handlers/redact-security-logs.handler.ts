import type { LifecycleHandler } from '../services/lifecycle-worker.service'
import { defaultLifecycleHandlerDatabase, requireAccountParent, type LifecycleHandlerDatabase } from './handler-support'

export const createRedactSecurityLogsHandler = (
  database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase,
): LifecycleHandler => ({
  stepCode: 'redact_security_logs',
  category: 'SECURITY_LOGS',
  async planCount(context) {
    const parent = requireAccountParent(context)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query('SELECT COUNT(*) AS total FROM logs WHERE user_id=?', [parent.userId])
      return Number((rows as any[])?.[0]?.total || 0)
    })
  },
  async executeBatch(context) {
    const parent = requireAccountParent(context)
    const afterId = Number(context.cursor?.afterId || 0)
    return database.withTransaction(async connection => {
      const [rows] = await connection.query(
        'SELECT id FROM logs WHERE user_id=? AND id>? ORDER BY id LIMIT ?',
        [parent.userId, afterId, context.batchSize],
      )
      const ids = (rows as Array<{ id: number }>).map(row => row.id)
      if (ids.length > 0) {
        await connection.query(
          `UPDATE logs SET user_id=NULL, ip_address=NULL, user_agent=NULL,
                  details=NULL, message='已脱敏安全日志'
            WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids,
        )
      }
      if (afterId === 0) {
        await connection.query(
          'DELETE lf FROM login_failures lf JOIN users u ON u.id=? WHERE lf.email=u.email',
          [parent.userId],
        )
        await connection.query(
          'DELETE lf FROM auth_login_failures lf JOIN users u ON u.id=? WHERE lf.email=u.email',
          [parent.userId],
        )
      }
      const done = ids.length < context.batchSize
      return {
        processedCount: ids.length,
        nextCursor: done || ids.length === 0 ? null : { afterId: ids[ids.length - 1] },
        done,
      }
    })
  },
})
