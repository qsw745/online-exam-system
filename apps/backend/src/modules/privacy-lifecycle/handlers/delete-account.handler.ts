import { LifecyclePolicyError } from '../domain/lifecycle.policy'
import type { DeletionManifestStager } from '../services/deletion-manifest.service'
import type { LifecycleHandler, LifecycleTransaction } from '../services/lifecycle-worker.service'
import { defaultLifecycleHandlerDatabase, requireAccountParent, type LifecycleHandlerDatabase } from './handler-support'

export type { DeletionManifestStager } from '../services/deletion-manifest.service'

export const failClosedManifestStager: DeletionManifestStager = {
  async stageFingerprint() {
    throw Object.assign(new Error('删除墓碑暂存器尚未配置'), {
      code: 'LIFECYCLE_MANIFEST_NOT_CONFIGURED',
      recoverable: false,
    })
  },
}

export async function assertNoIdentityToAnonymousLink(
  connection: LifecycleTransaction,
  requestId: string,
): Promise<void> {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS identity_link_count FROM (
       SELECT er.id FROM exam_results er
        JOIN account_deletion_requests adr ON adr.user_id=er.user_id
       WHERE adr.request_id=? AND er.anonymous_subject_id IS NOT NULL
       UNION ALL
       SELECT ar.id FROM answer_records ar
        JOIN account_deletion_requests adr ON adr.user_id=ar.user_id
       WHERE adr.request_id=? AND ar.anonymous_subject_id IS NOT NULL
       UNION ALL
       SELECT ps.id FROM proctoring_sessions ps
        JOIN account_deletion_requests adr ON adr.user_id=ps.user_id
       WHERE adr.request_id=? AND ps.anonymous_subject_id IS NOT NULL
       UNION ALL
       SELECT pe.id FROM proctoring_events pe
        JOIN account_deletion_requests adr ON adr.user_id=pe.user_id
       WHERE adr.request_id=? AND pe.anonymous_subject_id IS NOT NULL
       UNION ALL
       SELECT pic.id FROM proctoring_identity_checks pic
        JOIN account_deletion_requests adr ON adr.user_id=pic.user_id
       WHERE adr.request_id=? AND pic.anonymous_subject_id IS NOT NULL
       UNION ALL
       SELECT prc.id FROM proctoring_review_cases prc
        JOIN account_deletion_requests adr ON adr.user_id=prc.user_id
       WHERE adr.request_id=? AND prc.anonymous_subject_id IS NOT NULL
     ) identity_links`,
    [requestId, requestId, requestId, requestId, requestId, requestId],
  )
  if (Number((rows as any[])?.[0]?.identity_link_count || 0) > 0) {
    throw Object.assign(new Error('仍存在原身份到匿名主体的关联'), {
      code: 'LIFECYCLE_IDENTITY_LINK_REMAINS',
      recoverable: false,
    })
  }
}

export function createDeleteAccountHandler(input: {
  database?: LifecycleHandlerDatabase
  manifest?: DeletionManifestStager
} = {}): LifecycleHandler {
  const database = input.database ?? defaultLifecycleHandlerDatabase
  const manifest = input.manifest ?? failClosedManifestStager
  return {
    stepCode: 'delete_account',
    category: 'ACCOUNT_ROW',
    async planCount(context) {
      const parent = requireAccountParent(context)
      return database.withTransaction(async connection => {
        const [rows] = await connection.query('SELECT COUNT(*) AS total FROM users WHERE id=?', [parent.userId])
        return Number((rows as any[])?.[0]?.total || 0)
      })
    },
    async executeBatch(context) {
      const parent = requireAccountParent(context)
      return database.withTransaction(async connection => {
        const [counts] = await connection.query(
          `SELECT COUNT(*) AS incomplete_count
             FROM data_lifecycle_steps
            WHERE request_id=?
              AND step_code NOT IN ('delete_account', 'sync_deletion_manifest')
              AND status<>'COMPLETED'
              AND NOT (status='HELD' AND action='RESTRICTED_RETENTION')`,
          [parent.requestId],
        )
        if (Number((counts as any[])?.[0]?.incomplete_count || 0) > 0) {
          throw new LifecyclePolicyError('前置步骤尚未完成', 'LIFECYCLE_PREREQUISITE_INCOMPLETE', 409)
        }
        await assertNoIdentityToAnonymousLink(connection, parent.requestId)
        const [users] = await connection.query(
          'SELECT public_id, email FROM users WHERE id=? LIMIT 1 FOR UPDATE',
          [parent.userId],
        )
        const user = (users as any[])?.[0]
        if (!user) return { processedCount: 0, nextCursor: null, done: true }
        const publicId = String(user.public_id || '')
        if (!publicId) {
          throw Object.assign(new Error('用户缺少不可逆墓碑所需公开编号'), {
            code: 'LIFECYCLE_PUBLIC_ID_MISSING',
            recoverable: false,
          })
        }
        await manifest.stageFingerprint({
          requestId: parent.requestId,
          dataRegion: context.dataRegion,
          publicId,
          connection,
          completedAt: context.now,
          notificationEmail: String(user.email || ''),
        })
        await connection.query('DELETE FROM users WHERE id=?', [parent.userId])
        const [requests] = await connection.query(
          'SELECT user_id FROM account_deletion_requests WHERE request_id=? LIMIT 1',
          [parent.requestId],
        )
        if ((requests as any[])?.[0]?.user_id != null) {
          throw Object.assign(new Error('账号删除后注销请求仍关联原用户'), {
            code: 'LIFECYCLE_REQUEST_USER_LINK_REMAINS',
            recoverable: false,
          })
        }
        await connection.query(
          `UPDATE account_deletion_requests
              SET confirmation_phrase=NULL, reauthenticated_at=NULL
            WHERE request_id=?`,
          [parent.requestId],
        )
        return { processedCount: 1, nextCursor: null, done: true }
      })
    },
  }
}
