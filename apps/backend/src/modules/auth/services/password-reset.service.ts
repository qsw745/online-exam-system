import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { ResultSetHeader } from 'mysql2/promise'
import { pool } from '@config/database.js'
import type { IUser, IPasswordResetToken } from '../domain/auth.model.js'
import { emailService } from '@infrastructure/email/email.service.js'

export class PasswordResetService {
  async send(email: string) {
    const [users] = await pool.query<IUser[]>('SELECT id, username, email FROM users WHERE email = ?', [email])
    if (users.length === 0) return // 安全起见不暴露
    const user = users[0]

    const [existing] = await pool.query<IPasswordResetToken[]>(
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND expires_at > NOW() AND used = FALSE ORDER BY id DESC LIMIT 1',
      [user.id]
    )
    if (existing.length) {
      const minutes = Math.floor((Date.now() - new Date(existing[0].created_at).getTime()) / 60000)
      if (minutes < 5) throw new Error('请求过于频繁，请5分钟后再试')
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [user.id])
      await conn.query<ResultSetHeader>(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt]
      )
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`
    await emailService.sendPasswordResetEmail(user.email, resetUrl, user.username || user.email.split('@')[0])
  }

  async validate(token: string) {
    const [rows] = await pool.query<(IPasswordResetToken & { email: string })[]>(
      `SELECT prt.*, u.email FROM password_reset_tokens prt JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
      [token]
    )
    if (!rows.length) throw new Error('重置令牌无效或已过期')
    return { email: rows[0].email }
  }

  async reset(token: string, newPassword: string) {
    const [rows] = await pool.query<(IPasswordResetToken & { email: string; user_id: number })[]>(
      `SELECT prt.*, u.email, u.id AS user_id FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
      [token]
    )
    if (!rows.length) throw new Error('重置令牌无效或已过期')
    const row = rows[0]

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const hashed = await bcrypt.hash(newPassword, 10)
      await conn.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, row.user_id])
      await conn.query('UPDATE password_reset_tokens SET used = TRUE, updated_at = NOW() WHERE id = ?', [row.id])
      await conn.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [row.user_id])
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  async cleanExpired(): Promise<number> {
    const [rs] = await pool.query<ResultSetHeader>(
      'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE'
    )
    return rs.affectedRows
  }
}
