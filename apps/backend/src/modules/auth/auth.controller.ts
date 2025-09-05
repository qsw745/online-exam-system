// apps/backend/src/modules/auth/auth.controller.ts
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Response } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import { RowDataPacket } from 'mysql2'

import { pool } from '@config/database.js'
import type { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

// 基础设施层
import { LoggerService } from '../../services/logger.service.js'

import { emailService } from '@infrastructure/email/email.service.js'

// ★ 统一密钥

import {
  getJwtSecret,
  getRefreshJwtSecret,
  ACCESS_JWT_EXPIRES_IN,
  REFRESH_JWT_EXPIRES_IN,
} from '@config/jwt.js'

interface IUser extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  status: 'active' | 'disabled'
  created_at: Date
  updated_at: Date
}

interface IRoleRow extends RowDataPacket {
  id: number
  code: string
}

type AuthResponseData = {
  token: string
  user?: Omit<IUser, 'password'> & { org_id?: number | null }
}

interface JwtPayload {
  id: number
  email: string
  role_ids?: number[]
  roles?: Array<{ id: number; code: string }>
}

async function fetchUserRoles(
  userId: number
): Promise<{ roles: Array<{ id: number; code: string }>; role_ids: number[] }> {
  const [rolesRows] = await pool.query<IRoleRow[]>(
    `SELECT r.id, r.code
       FROM roles r
       JOIN user_org_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?`,
    [userId]
  )
  const roles = rolesRows.map(r => ({ id: Number(r.id), code: String(r.code) }))
  const role_ids = roles.map(r => r.id)
  return { roles, role_ids }
}

async function attachUserToDefaultOrgAndRoles(userId: number) {
  const [[org]] = await pool.query<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
  const orgId = org?.id
  if (!orgId) throw new Error('默认机构不存在，请先执行迁移脚本')

  await pool.query(
    `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at)
     VALUES (?, ?, 1, NOW())`,
    [userId, orgId]
  )

  const [defaults] = await pool.query<RowDataPacket[]>(`SELECT role_id FROM org_default_roles WHERE org_id=?`, [orgId])
  let roleIds = defaults.map(r => Number(r.role_id))

  if (roleIds.length === 0) {
    const [[student]] = await pool.query<RowDataPacket[]>(`SELECT id FROM roles WHERE code='student' LIMIT 1`)
    if (!student?.id) throw new Error('默认角色 student 不存在')
    roleIds = [Number(student.id)]
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
/** ===== 工具：签发/存储 Token ===== */

function signAccessToken(payloadBase: Omit<JwtPayload, 'type' | 'jti'>) {
  const payload: JwtPayload = { ...payloadBase, type: 'access' }
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_JWT_EXPIRES_IN } as SignOptions)
}

function signRefreshToken(payloadBase: Omit<JwtPayload, 'type'> & { jti: string }) {
  const payload: JwtPayload = { ...payloadBase, type: 'refresh' }
  return jwt.sign(payload, getRefreshJwtSecret(), { expiresIn: REFRESH_JWT_EXPIRES_IN } as SignOptions)
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}
type RefreshCookieOpts = {
  remember?: boolean
}
function setRefreshCookie(res: Response, token: string, opts?: RefreshCookieOpts) {
  const isProd = process.env.NODE_ENV === 'production'
  // remember=true 可适当延长 cookie 存活，默认与 refresh 过期一致
  const maxAgeMs =
    typeof REFRESH_JWT_EXPIRES_IN === 'number'
      ? REFRESH_JWT_EXPIRES_IN * 1000
      : /(\d+)([mhd])/.test(String(REFRESH_JWT_EXPIRES_IN))
      ? (() => {
          const [, n, u] = String(REFRESH_JWT_EXPIRES_IN).match(/(\d+)([mhd])/)!
          const num = Number(n)
          return u === 'm' ? num * 60 * 1000 : u === 'h' ? num * 3600 * 1000 : num * 24 * 3600 * 1000
        })()
      : 7 * 24 * 3600 * 1000

  res.cookie('rt', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth', // 仅限 auth 子路由，减少泄露面
    maxAge: opts?.remember ? maxAgeMs : maxAgeMs, // 你也可以按 remember 调整
  })
}
async function persistRefreshToken(params: {
  userId: number
  jti: string
  rawToken: string
  userAgent?: string
  ip?: string
  expiresAt: Date
}) {
  const { userId, jti, rawToken, userAgent, ip, expiresAt } = params
  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, jti, sha256(rawToken), userAgent || null, ip || null, expiresAt]
  )
}
async function rotateRefreshToken(
  oldJti: string,
  newParams: {
    userId: number
    jti: string
    rawToken: string
    userAgent?: string
    ip?: string
    expiresAt: Date
  }
) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(`UPDATE refresh_tokens SET revoked=1, replaced_by_jti=? WHERE jti=?`, [newParams.jti, oldJti])
    await conn.execute(
      `INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newParams.userId,
        newParams.jti,
        sha256(newParams.rawToken),
        newParams.userAgent || null,
        newParams.ip || null,
        newParams.expiresAt,
      ]
    )
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
async function revokeRefreshTokenByJti(jti: string) {
  await pool.execute(`UPDATE refresh_tokens SET revoked=1 WHERE jti=?`, [jti])
}
export class AuthController {
  /** 注册 */
  static async register(req: AuthRequest, res: Response<ApiResponse<AuthResponseData>>) {
    try {
      const { username, email, password, remember } = req.body
      if (!email || !password) {
        return res.status(400).json({ success: false, error: '缺少必填字段' })
      }

      const [existing] = await pool.query<IUser[]>('SELECT id FROM users WHERE email = ?', [email])
      if (existing.length > 0) {
        return res.status(409).json({ success: false, error: '用户已存在' })
      }

      const hashed = bcrypt.hashSync(password, 10)
      const [ins] = await pool.query(
        `INSERT INTO users (username, email, password, status)
         VALUES (?, ?, ?, 'active')`,
        [username || email.split('@')[0], email, hashed]
      )
      const userId = (ins as any).insertId as number

      const orgId = await attachUserToDefaultOrgAndRoles(userId)
      const { roles, role_ids } = await fetchUserRoles(userId)

      // 发放 Access + Refresh
      const access = signAccessToken({ id: userId, email, role_ids, roles })
      const jti = crypto.randomUUID()
      const refresh = signRefreshToken({ id: userId, email, role_ids, roles, jti })
      const refreshExp = new Date(
        Date.now() + (typeof REFRESH_JWT_EXPIRES_IN === 'number' ? REFRESH_JWT_EXPIRES_IN * 1000 : 7 * 24 * 3600 * 1000)
      )
      await persistRefreshToken({
        userId,
        jti,
        rawToken: refresh,
        userAgent: req.get('User-Agent') || undefined,
        ip: req.ip,
        expiresAt: refreshExp,
      })
      setRefreshCookie(res, refresh, { remember: !!remember })

      const [userRows] = await pool.query<IUser[]>(
        `SELECT id, username, email, status, created_at, updated_at
           FROM users WHERE id=?`,
        [userId]
      )
      const user = userRows[0]

      return res.status(201).json({ success: true, data: { token: access, user: { ...user, org_id: orgId } } })
    } catch (error) {
      console.error('注册用户错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '创建用户失败' })
    }
  }

  /** 登录 */
  static async login(req: AuthRequest, res: Response<ApiResponse<AuthResponseData>>) {
    try {
      const { email, password, remember } = req.body

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

      const ok = bcrypt.compareSync(password, user.password)
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

      const [[primary]] = await pool.query<RowDataPacket[]>(
        `SELECT org_id FROM user_organizations WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
        [user.id]
      )
      const orgId = primary?.org_id ?? null

      const { roles, role_ids } = await fetchUserRoles(user.id)

      // Access + Refresh
      const access = signAccessToken({ id: user.id, email: user.email, role_ids, roles })
      const jti = crypto.randomUUID()
      const refresh = signRefreshToken({ id: user.id, email: user.email, role_ids, roles, jti })
      const refreshExp = new Date(
        Date.now() + (typeof REFRESH_JWT_EXPIRES_IN === 'number' ? REFRESH_JWT_EXPIRES_IN * 1000 : 7 * 24 * 3600 * 1000)
      )
      await persistRefreshToken({
        userId: user.id,
        jti,
        rawToken: refresh,
        userAgent: req.get('User-Agent') || undefined,
        ip: req.ip,
        expiresAt: refreshExp,
      })
      setRefreshCookie(res, refresh, { remember: !!remember })

      await LoggerService.logLogin({
        userId: user.id,
        username: user.username || user.email,
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const { password: _omit, ...userWithoutPassword } = user
      return res.json({ success: true, data: { token: access, user: { ...userWithoutPassword, org_id: orgId } } })
    } catch (error) {
      console.error('用户登录错误:', error)
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '登录失败' })
    }
  }
  /** 刷新 Access Token（静默） */
  static async refresh(req: AuthRequest, res: Response<ApiResponse<{ token: string }>>) {
    try {
      const rt = req.cookies?.rt
      if (!rt) return res.status(401).json({ success: false, error: '缺少刷新令牌' })

      let payload: JwtPayload
      try {
        payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload
      } catch (e) {
        return res.status(401).json({ success: false, error: '刷新令牌无效或已过期' })
      }
      if (payload.type !== 'refresh' || !payload.jti || !payload.id) {
        return res.status(401).json({ success: false, error: '刷新令牌格式不正确' })
      }

      // DB 校验 + 未被吊销
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM refresh_tokens WHERE jti=? LIMIT 1`, [
        payload.jti,
      ])
      if (rows.length === 0) return res.status(401).json({ success: false, error: '刷新令牌不存在或已吊销' })
      const rtRow: any = rows[0]
      if (rtRow.revoked) return res.status(401).json({ success: false, error: '刷新令牌已吊销' })
      if (rtRow.token_hash !== sha256(rt)) return res.status(401).json({ success: false, error: '刷新令牌不匹配' })
      if (new Date(rtRow.expires_at).getTime() <= Date.now()) {
        return res.status(401).json({ success: false, error: '刷新令牌已过期' })
      }

      // 轮换 refresh（ROTATE）：旧 -> revoked，新 -> 入库 + 写入 cookie
      const { roles, role_ids } = await fetchUserRoles(payload.id)
      const access = signAccessToken({ id: payload.id, email: payload.email, role_ids, roles })

      const newJti = crypto.randomUUID()
      const newRefresh = signRefreshToken({ id: payload.id, email: payload.email, role_ids, roles, jti: newJti })
      const newRefreshExp = new Date(
        Date.now() + (typeof REFRESH_JWT_EXPIRES_IN === 'number' ? REFRESH_JWT_EXPIRES_IN * 1000 : 7 * 24 * 3600 * 1000)
      )
      await rotateRefreshToken(payload.jti, {
        userId: payload.id,
        jti: newJti,
        rawToken: newRefresh,
        userAgent: req.get('User-Agent') || undefined,
        ip: req.ip,
        expiresAt: newRefreshExp,
      })
      setRefreshCookie(res, newRefresh)

      return res.json({ success: true, data: { token: access } })
    } catch (error) {
      console.error('刷新令牌错误:', error)
      return res.status(500).json({ success: false, error: '刷新失败，请重新登录' })
    }
  }
  /** 登出：吊销当前 Refresh */
  static async logout(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const rt = req.cookies?.rt
      if (rt) {
        try {
          const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload
          if (payload?.jti) await revokeRefreshTokenByJti(payload.jti)
        } catch {}
      }
      res.clearCookie('rt', { path: '/api/auth' })
      return res.json({ success: true, data: null, message: '已退出登录' } as any)
    } catch (error) {
      console.error('登出错误:', error)
      return res.status(500).json({ success: false, error: '登出失败' })
    }
  }
  // 忘记密码 - 发送重置邮件
  static async forgotPassword(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email } = req.body
      if (!email) return res.status(400).json({ success: false, error: '邮箱地址不能为空' })

      const [users] = await pool.execute<IUser[]>('SELECT id, email FROM users WHERE email = ?', [email])
      if (users.length === 0) return res.status(404).json({ success: false, error: '该邮箱地址未注册' })

      const user = users[0]
      const resetToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await pool.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])
      await pool.execute('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [
        user.id,
        resetToken,
        expiresAt,
      ])

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`
      await emailService.sendPasswordResetEmail(email, resetUrl, user.username || email.split('@')[0])

      return res.json({ success: true, data: null, message: '密码重置邮件已发送，请查收邮件' })
    } catch (error) {
      console.error('忘记密码错误:', error)
      return res.status(500).json({ success: false, error: '发送重置邮件失败，请稍后重试' })
    }
  }

  // 验证重置令牌
  static async validateResetToken(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { token } = req.body
      if (!token) return res.status(400).json({ success: false, error: '重置令牌不能为空' })

      const [tokens] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      )
      if (tokens.length === 0) return res.status(410).json({ success: false, error: '重置链接无效或已过期' })

      return res.json({ success: true, message: '重置令牌有效', data: null })
    } catch (error) {
      console.error('验证重置令牌错误:', error)
      return res.status(500).json({ success: false, error: '验证失败，请稍后重试' })
    }
  }

  // 重置密码
  static async resetPassword(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { token, newPassword } = req.body
      if (!token || !newPassword) return res.status(400).json({ success: false, error: '重置令牌和新密码不能为空' })
      if (newPassword.length < 6) return res.status(400).json({ success: false, error: '密码长度至少为6位' })

      const [tokens] = await pool.execute<RowDataPacket[]>(
        'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      )
      if (tokens.length === 0) return res.status(410).json({ success: false, error: '重置链接无效或已过期' })

      const userId = (tokens[0] as any).user_id
      const hashedPassword = bcrypt.hashSync(newPassword, 12)

      await pool.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId])
      await pool.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token])

      return res.json({ success: true, message: '密码重置成功', data: null })
    } catch (error) {
      console.error('重置密码错误:', error)
      return res.status(500).json({ success: false, error: '密码重置失败，请稍后重试' })
    }
  }
}
