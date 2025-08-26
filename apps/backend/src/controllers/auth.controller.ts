import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Response } from 'express'
import jwt from 'jsonwebtoken'
import { RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { AuthRequest } from '../middleware/auth.middleware.js'
import { LoggerService } from '../services/logger.service.js'
import { ApiResponse } from '../types/response.js'
import { emailService } from '../utils/email.service.js'

interface IUser extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  status: 'active' | 'disabled'
  created_at: Date
  updated_at: Date
}

type AuthResponseData = {
  token: string
  user?: Omit<IUser, 'password'> & { org_id?: number } // 登录可回传当前org
}

interface JwtPayload {
  id: number
  email: string
}
// 辅助函数：拿默认org、把用户挂到org（主组织）、赋默认角色
async function attachUserToDefaultOrgAndRoles(userId: number) {
  // 1) 默认组织
  const [[org]] = await pool.query<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
  const orgId = org?.id
  if (!orgId) throw new Error('默认机构不存在，请先执行迁移脚本')

  // 2) 绑定主组织
  await pool.query(
    `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at)
     VALUES (?, ?, 1, NOW())`,
    [userId, orgId]
  )

  // 3) 默认角色（来自 org_default_roles），若没配置，回退 student
  const [defaults] = await pool.query<RowDataPacket[]>(`SELECT role_id FROM org_default_roles WHERE org_id=?`, [orgId])
  let roleIds = defaults.map(r => r.role_id)

  if (roleIds.length === 0) {
    const [[student]] = await pool.query<RowDataPacket[]>(`SELECT id FROM roles WHERE code='student' LIMIT 1`)
    if (!student?.id) throw new Error('默认角色 student 不存在')
    roleIds = [student.id]
  }

  for (const rid of roleIds) {
    await pool.query(
      `INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, orgId, rid]
    )
  }

  return orgId as number
}
export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<AuthResponseData>>) {
    try {
      const { username, email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({ success: false, error: '缺少必填字段' })
      }

      const [existing] = await pool.query<IUser[]>('SELECT id FROM users WHERE email = ?', [email])
      if (existing.length > 0) {
        return res.status(409).json({ success: false, error: '用户已存在' })
      }

      const hashed = await bcrypt.hash(password, 10)
      const [ins] = await pool.query(
        `INSERT INTO users (username, email, password, status)
       VALUES (?, ?, ?, 'active')`,
        [username || email.split('@')[0], email, hashed]
      )
      const userId = (ins as any).insertId

      // 注册后：挂默认机构 + 赋默认角色
      const orgId = await attachUserToDefaultOrgAndRoles(userId)

      const payload: JwtPayload = { id: userId, email }
      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      })

      const [rows] = await pool.query<IUser[]>(
        `SELECT id, username, email, status, created_at, updated_at
       FROM users WHERE id=?`,
        [userId]
      )

      return res.status(201).json({
        success: true,
        data: { token, user: { ...rows[0], org_id: orgId } },
      })
    } catch (error) {
      console.error('注册用户错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '创建用户失败',
      })
    }
  }

  static async login(req: AuthRequest, res: Response<ApiResponse<AuthResponseData>>) {
    try {
      const { email, password } = req.body

      const [users] = await pool.query<IUser[]>('SELECT * FROM users WHERE email = ?', [email])
      if (users.length === 0) {
        await LoggerService.logLogin({
          username: email,
          status: 'failed',
          failureReason: '用户不存在',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        })
        return res.status(401).json({ success: false, error: '用户不存在' })
      }

      const user = users[0]
      if ((user.status || 'active').toLowerCase() !== 'active') {
        await LoggerService.logLogin({
          userId: user.id,
          username: user.username || user.email,
          status: 'failed',
          failureReason: '账号已被禁用',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        })
        return res.status(403).json({ success: false, error: '账号已被禁用，请联系管理员' })
      }

      const ok = await bcrypt.compare(password, user.password)
      if (!ok) {
        await LoggerService.logLogin({
          userId: user.id,
          username: user.username || user.email,
          status: 'failed',
          failureReason: '密码错误',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        })
        return res.status(401).json({ success: false, error: '密码错误' })
      }

      // 尝试拿用户主组织ID，方便前端初始化
      const [[primary]] = await pool.query<RowDataPacket[]>(
        `SELECT org_id FROM user_organizations WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
        [user.id]
      )
      const orgId = primary?.org_id || null

      const payload: JwtPayload = { id: user.id, email: user.email }
      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      })

      await LoggerService.logLogin({
        userId: user.id,
        username: user.username || user.email,
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const { password: _omit, ...userWithoutPassword } = user
      return res.json({
        success: true,
        data: { token, user: { ...userWithoutPassword, org_id: orgId ?? undefined } },
      })
    } catch (error) {
      console.error('用户登录错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      })
    }
  }

  // 忘记密码 - 发送重置邮件
  static async forgotPassword(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({
          success: false,
          error: '邮箱地址不能为空',
        })
      }

      // 检查用户是否存在
      const [users] = await pool.execute<IUser[]>('SELECT id, email FROM users WHERE email = ?', [email])

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: '该邮箱地址未注册',
        })
      }

      const user = users[0]

      // 生成重置令牌
      const resetToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期

      // 删除该用户之前的重置令牌
      await pool.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])

      // 保存新的重置令牌
      await pool.execute('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [
        user.id,
        resetToken,
        expiresAt,
      ])

      // 发送重置邮件
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`
      await emailService.sendPasswordResetEmail(email, resetUrl)

      return res.json({
        success: true,
        message: '密码重置邮件已发送，请查收邮件',
      })
    } catch (error) {
      console.error('忘记密码错误:', error)
      return res.status(500).json({
        success: false,
        error: '发送重置邮件失败，请稍后重试',
      })
    }
  }

  // 验证重置令牌
  static async validateResetToken(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { token } = req.body

      if (!token) {
        return res.status(400).json({
          success: false,
          error: '重置令牌不能为空',
        })
      }

      // 查找有效的重置令牌
      const [tokens] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      )

      if (tokens.length === 0) {
        return res.status(410).json({
          success: false,
          error: '重置链接无效或已过期',
        })
      }

      return res.json({
        success: true,
        message: '重置令牌有效',
      })
    } catch (error) {
      console.error('验证重置令牌错误:', error)
      return res.status(500).json({
        success: false,
        error: '验证失败，请稍后重试',
      })
    }
  }

  // 重置密码
  static async resetPassword(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { token, newPassword } = req.body

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: '重置令牌和新密码不能为空',
        })
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: '密码长度至少为6位',
        })
      }

      // 查找有效的重置令牌
      const [tokens] = await pool.execute<RowDataPacket[]>(
        'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      )

      if (tokens.length === 0) {
        return res.status(410).json({
          success: false,
          error: '重置链接无效或已过期',
        })
      }

      const userId = tokens[0].user_id

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // 更新用户密码
      await pool.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId])

      // 删除已使用的重置令牌
      await pool.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token])

      return res.json({
        success: true,
        message: '密码重置成功',
      })
    } catch (error) {
      console.error('重置密码错误:', error)
      return res.status(500).json({
        success: false,
        error: '密码重置失败，请稍后重试',
      })
    }
  }
}
