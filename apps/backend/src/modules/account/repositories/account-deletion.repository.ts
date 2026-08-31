import { randomUUID } from 'crypto'
import { pool } from '@/config/database'
import type { DataRegion } from '@/modules/auth/domain/account-region.policy'

export type AccountDeletionRow = {
  request_id: string
  user_id: number
  data_region: DataRegion
  status: 'PENDING' | 'CANCELLED' | 'COMPLETED'
  retention_summary_json: unknown
  requested_at: Date
  scheduled_for: Date
  cancelled_at: Date | null
  completed_at: Date | null
}

function parseRetention(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeRow(row: any): AccountDeletionRow | null {
  if (!row) return null
  return { ...row, retention_summary_json: parseRetention(row.retention_summary_json) } as AccountDeletionRow
}

export const AccountDeletionRepository = {
  async createPending(params: {
    userId: number
    dataRegion: DataRegion
    confirmationPhrase: string
    retentionSummary: unknown
    scheduledFor: Date
    reauthenticatedAt: Date
  }): Promise<{ row: AccountDeletionRow; revokedSessionIds: string[] }> {
    const connection = await (pool as any).getConnection()
    const requestId = randomUUID()
    let revokedSessionIds: string[] = []
    try {
      await connection.beginTransaction()
      const [users] = await connection.query(
        `SELECT id, deletion_status FROM users WHERE id=? LIMIT 1 FOR UPDATE`,
        [params.userId],
      )
      const user = users?.[0]
      if (!user) throw Object.assign(new Error('用户不存在'), { status: 404, code: 'NOT_FOUND' })
      if (user.deletion_status && !['ACTIVE', 'CANCELLED'].includes(String(user.deletion_status))) {
        throw Object.assign(new Error('账号已有进行中的注销申请'), {
          status: 409,
          code: 'ACCOUNT_DELETION_PENDING',
        })
      }

      await connection.query(
        `INSERT INTO account_deletion_requests
          (request_id, user_id, data_region, status, confirmation_phrase,
           retention_summary_json, reauthenticated_at, scheduled_for)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
        [
          requestId,
          params.userId,
          params.dataRegion,
          params.confirmationPhrase,
          JSON.stringify(params.retentionSummary),
          params.reauthenticatedAt,
          params.scheduledFor,
        ],
      )
      const [sessions] = await connection.query(
        `SELECT jti FROM refresh_tokens WHERE user_id=? AND revoked=0 FOR UPDATE`,
        [params.userId],
      )
      revokedSessionIds = (sessions as Array<{ jti: string }>).map(session => String(session.jti)).filter(Boolean)
      await connection.query(`UPDATE refresh_tokens SET revoked=1 WHERE user_id=? AND revoked=0`, [params.userId])
      await connection.query(`UPDATE users SET deletion_status='PENDING' WHERE id=?`, [params.userId])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    const row = await this.findByRequestId(requestId)
    if (!row) throw new Error('注销申请创建后无法读取')
    return { row, revokedSessionIds }
  },

  async findLatestByUser(userId: number): Promise<AccountDeletionRow | null> {
    const [rows] = await (pool as any).query(
      `SELECT request_id, user_id, data_region, status, retention_summary_json,
              requested_at, scheduled_for, cancelled_at, completed_at
         FROM account_deletion_requests
        WHERE user_id=?
        ORDER BY id DESC
        LIMIT 1`,
      [userId],
    )
    return normalizeRow(rows?.[0])
  },

  async findByRequestId(requestId: string): Promise<AccountDeletionRow | null> {
    const [rows] = await (pool as any).query(
      `SELECT request_id, user_id, data_region, status, retention_summary_json,
              requested_at, scheduled_for, cancelled_at, completed_at
         FROM account_deletion_requests
        WHERE request_id=?
        LIMIT 1`,
      [requestId],
    )
    return normalizeRow(rows?.[0])
  },

  async cancelLatest(userId: number): Promise<AccountDeletionRow> {
    const connection = await (pool as any).getConnection()
    let requestId = ''
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query(
        `SELECT request_id
           FROM account_deletion_requests
          WHERE user_id=? AND status='PENDING'
          ORDER BY id DESC
          LIMIT 1 FOR UPDATE`,
        [userId],
      )
      requestId = String(rows?.[0]?.request_id || '')
      if (!requestId) {
        throw Object.assign(new Error('没有可取消的注销申请'), { status: 404, code: 'NOT_FOUND' })
      }
      await connection.query(
        `UPDATE account_deletion_requests
            SET status='CANCELLED', cancelled_at=NOW()
          WHERE request_id=? AND status='PENDING'`,
        [requestId],
      )
      await connection.query(`UPDATE users SET deletion_status='ACTIVE' WHERE id=?`, [userId])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    const row = await this.findByRequestId(requestId)
    if (!row) throw new Error('注销取消后无法读取状态')
    return row
  },
}
