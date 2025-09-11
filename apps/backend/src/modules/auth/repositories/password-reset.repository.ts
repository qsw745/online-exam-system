/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { IPasswordResetToken, IUser } from '../domain/auth.model'

export class PasswordResetRepository {
  static async findUserByEmail(email: string): Promise<Pick<IUser, 'id' | 'username' | 'email'> | null> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT id, username, email FROM users WHERE email=?`, [email])
    return (rows[0] as any) || null
  }

  static async latestValidToken(userId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM password_reset_tokens
        WHERE user_id=? AND expires_at > NOW() AND used = FALSE
        ORDER BY id DESC LIMIT 1`,
      [userId]
    )
    return (rows[0] as any) || null
  }

  static async invalidateAllActive(userId: number) {
    await pool.query(`UPDATE password_reset_tokens SET used = TRUE WHERE user_id=? AND used = FALSE`, [userId])
  }

  static async insertToken(userId: number, token: string, expiresAt: Date) {
    await pool.query<ResultSetHeader>(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, token, expiresAt]
    )
  }

  static async findValidByToken(token: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT prt.*, u.email, u.id AS user_id
         FROM password_reset_tokens prt
         JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE
        LIMIT 1`,
      [token]
    )
    return (rows[0] as any) || null
  }

  static async setUsed(id: number) {
    await pool.query(`UPDATE password_reset_tokens SET used = TRUE, updated_at=NOW() WHERE id=?`, [id])
  }

  static async setUsedAllByUser(userId: number) {
    await pool.query(`UPDATE password_reset_tokens SET used = TRUE WHERE user_id=? AND used = FALSE`, [userId])
  }

  static async updateUserPassword(userId: number, hashed: string) {
    await pool.query(`UPDATE users SET password=?, updated_at=NOW() WHERE id=?`, [hashed, userId])
  }

  static async cleanExpired(): Promise<number> {
    const [rs] = await pool.query<ResultSetHeader>(
      `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE`
    )
    return rs.affectedRows
  }
}
