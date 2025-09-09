// apps/backend/src/modules/auth/repositories/token.repository.ts
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { pool } from '@config/database'

// WebCrypto 版 sha256，避免引入 'crypto' 模块类型
export async function sha256(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s)
  const buf = await (globalThis.crypto as any).subtle.digest('SHA-256', enc)
  const bytes = Array.from(new Uint8Array(buf))
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 可选：在启动时调用，确保 refresh_tokens 表存在
 */
export async function ensureRefreshTokenTable() {
  const sql = `
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    jti VARCHAR(128) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    user_agent VARCHAR(255) NULL,
    ip VARCHAR(64) NULL,
    expires_at DATETIME NOT NULL,
    revoked TINYINT(1) NOT NULL DEFAULT 0,
    replaced_by_jti VARCHAR(128) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_jti (jti),
    KEY idx_user (user_id),
    KEY idx_expires (expires_at),
    KEY idx_revoked (revoked)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `
  await pool.query(sql)
}

export interface RefreshTokenRow extends RowDataPacket {
  id: number
  user_id: number
  jti: string
  token_hash: string
  user_agent: string | null
  ip: string | null
  expires_at: Date
  revoked: 0 | 1
  replaced_by_jti: string | null
  created_at: Date
  updated_at: Date
}

export const TokenRepository = {
  async insertRefresh(params: {
    userId: number
    jti: string
    token_hash: string
    userAgent?: string | null
    ip?: string | null
    expiresAt: Date
  }) {
    const { userId, jti, token_hash, userAgent, ip, expiresAt } = params
    await pool.execute<ResultSetHeader>(
      `INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, jti, token_hash, userAgent ?? null, ip ?? null, expiresAt]
    )
  },

  async rotate(
    oldJti: string,
    next: {
      userId: number
      jti: string
      token_hash: string
      userAgent?: string | null
      ip?: string | null
      expiresAt: Date
    }
  ) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute<ResultSetHeader>(`UPDATE refresh_tokens SET revoked=1, replaced_by_jti=? WHERE jti=?`, [
        next.jti,
        oldJti,
      ])

      await conn.execute<ResultSetHeader>(
        `INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [next.userId, next.jti, next.token_hash, next.userAgent ?? null, next.ip ?? null, next.expiresAt]
      )

      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  async revokeByJti(jti: string) {
    await pool.execute<ResultSetHeader>(`UPDATE refresh_tokens SET revoked=1 WHERE jti=?`, [jti])
  },

  async findByJti(jti: string) {
    const [rows] = await pool.execute<RefreshTokenRow[]>(`SELECT * FROM refresh_tokens WHERE jti=? LIMIT 1`, [jti])
    return rows[0] ?? null
  },

  async purgeExpired(now = new Date()) {
    const [ret] = await pool.execute<ResultSetHeader>(`DELETE FROM refresh_tokens WHERE expires_at <= ?`, [now])
    return ret.affectedRows
  },
}
