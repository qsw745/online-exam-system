// apps/backend/src/modules/auth/password-reset.controller.ts
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { pool } from '@config/database.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

import { ApiResponse } from 'types/response.js'
import { ForgotPasswordRequest, ResetPasswordRequest, PasswordResetResponse } from 'types/password-reset.js'
import { emailService } from '@infrastructure/email/email.service.js'

interface IUser extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  role: 'admin' | 'teacher' | 'student'
  created_at: Date
  updated_at: Date
}

interface IPasswordResetToken extends RowDataPacket {
  id: number
  user_id: number
  token: string
  expires_at: Date
  used: boolean
  created_at: Date
  updated_at: Date
}

export class PasswordResetController {
  /** 发送密码重置邮件 */
  static async forgotPassword(req: Request, res: Response<ApiResponse<PasswordResetResponse>>) {
    try {
      const { email }: ForgotPasswordRequest = req.body

      if (!email) {
        return res.status(400).json({ success: false, error: '邮箱地址不能为空' })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: '邮箱格式不正确' })
      }

      const [users] = await pool.query<IUser[]>('SELECT id, username, email FROM users WHERE email = ?', [email])

      // 出于安全考虑，即使用户不存在也返回成功
      if (users.length === 0) {
        return res.json({
          success: true,
          data: { success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' },
        })
      }

      const user = users[0]

      // 限流：检查是否已有未过期令牌
      const [existingTokens] = await pool.query<IPasswordResetToken[]>(
        'SELECT * FROM password_reset_tokens WHERE user_id = ? AND expires_at > NOW() AND used = FALSE ORDER BY id DESC LIMIT 1',
        [user.id]
      )

      if (existingTokens.length > 0) {
        const last = existingTokens[0]
        const minutes = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 60000)
        if (minutes < 5) {
          return res.status(429).json({ success: false, error: '请求过于频繁，请5分钟后再试' })
        }
      }

      const resetToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1小时

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 将之前未使用的令牌全部标记为已使用
        await connection.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [
          user.id,
        ])

        // 插入新的令牌
        await connection.query<ResultSetHeader>(
          'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
          [user.id, resetToken, expiresAt]
        )

        await connection.commit()
      } catch (e) {
        await connection.rollback()
        throw e
      } finally {
        connection.release()
      }

      // 尝试发送邮件（失败也不暴露给用户）
      try {
        await emailService.sendPasswordResetEmail(user.email, resetToken, user.username)
      } catch {
        // 忽略发送失败（可在此处记录日志）
      }

      return res.json({
        success: true,
        data: { success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' },
      })
    } catch (error) {
      console.error('忘记密码处理错误:', error)
      return res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' })
    }
  }

  /** 验证重置令牌 */
  static async validateResetToken(req: Request, res: Response<ApiResponse<{ valid: boolean; email?: string }>>) {
    try {
      const { token } = req.params
      if (!token) {
        return res.status(400).json({ success: false, error: '重置令牌不能为空' })
      }

      const [tokens] = await pool.query<(IPasswordResetToken & { email: string })[]>(
        `SELECT prt.*, u.email
         FROM password_reset_tokens prt
         JOIN users u ON prt.user_id = u.id
         WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
        [token]
      )

      if (tokens.length === 0) {
        return res.status(400).json({ success: false, error: '重置令牌无效或已过期' })
      }

      return res.json({ success: true, data: { valid: true, email: tokens[0].email } })
    } catch (error) {
      console.error('验证重置令牌错误:', error)
      return res.status(500).json({ success: false, error: '服务器内部错误' })
    }
  }

  /** 重置密码 */
  static async resetPassword(req: Request, res: Response<ApiResponse<PasswordResetResponse>>) {
    try {
      const { token, newPassword, confirmPassword }: ResetPasswordRequest = req.body

      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, error: '所有字段都是必填的' })
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, error: '两次输入的密码不一致' })
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: '密码长度至少为6位' })
      }

      const [tokens] = await pool.query<(IPasswordResetToken & { email: string })[]>(
        `SELECT prt.*, u.email, u.id AS user_id
         FROM password_reset_tokens prt
         JOIN users u ON prt.user_id = u.id
         WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
        [token]
      )

      if (tokens.length === 0) {
        return res.status(400).json({ success: false, error: '重置令牌无效或已过期' })
      }

      const tokenRow = tokens[0]

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        const hashed = await bcrypt.hash(newPassword, 10)

        await connection.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [
          hashed,
          tokenRow.user_id,
        ])

        await connection.query('UPDATE password_reset_tokens SET used = TRUE, updated_at = NOW() WHERE id = ?', [
          tokenRow.id,
        ])

        await connection.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [
          tokenRow.user_id,
        ])

        await connection.commit()
      } catch (e) {
        await connection.rollback()
        throw e
      } finally {
        connection.release()
      }

      return res.json({
        success: true,
        data: { success: true, message: '密码重置成功，请使用新密码登录' },
      })
    } catch (error) {
      console.error('重置密码错误:', error)
      return res.status(500).json({ success: false, error: '服务器内部错误，请稍后重试' })
    }
  }

  /** 清理过期令牌（管理员） */
  static async cleanExpiredTokens(_req: Request, res: Response<ApiResponse<{ cleaned: number }>>) {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE'
      )
      return res.json({ success: true, data: { cleaned: result.affectedRows } })
    } catch (error) {
      console.error('清理过期令牌错误:', error)
      return res.status(500).json({ success: false, error: '清理失败' })
    }
  }
}
