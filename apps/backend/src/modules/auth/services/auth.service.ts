// apps/backend/src/modules/auth/services/auth.service.ts
/* eslint-disable @/typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs'
import type { SignOptions } from 'jsonwebtoken'
import type { RowDataPacket } from 'mysql2'
import { pool } from '@/config/database'
import { emailService } from '@/infrastructure/email/email.service'
import { LogRepository } from '@/modules/analytics/repositories/log.repository'
import { getJwtSecret, getRefreshJwtSecret, ACCESS_JWT_EXPIRES_IN, REFRESH_JWT_EXPIRES_IN } from '@/config/jwt'
import type { IUser, IRoleRow, JwtPayload, JwtRole, AuthResponseData } from '../domain/auth.model'
import { TokenRepository, sha256 } from '../repositories/token.repository'

declare const process: any

// 动态加载 jsonwebtoken，避免类型“不是模块”的问题
async function getJwt(): Promise<any> {
  const mod: any = await import('jsonwebtoken')
  return mod?.default ?? mod
}

/** ==== 角色/机构 ==== */
async function fetchUserRoles(userId: number): Promise<{ roles: JwtRole[]; role_ids: number[] }> {
  const [rows] = await pool.query<IRoleRow[]>(
    `SELECT r.id, r.code
       FROM roles r
       JOIN user_org_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?`,
    [userId]
  )
  const roles = rows.map(r => ({ id: Number(r.id), code: String(r.code) }))
  return { roles, role_ids: roles.map(r => r.id) }
}

async function attachUserToDefaultOrgAndRoles(userId: number) {
  const [[org]] = await pool.query<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
  const orgId = (org as any)?.id
  if (!orgId) throw new Error('默认机构不存在，请先执行迁移脚本')

  await pool.query(
    `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at) VALUES (?, ?, 1, NOW())`,
    [userId, orgId]
  )

  const [defs] = await pool.query<RowDataPacket[]>(`SELECT role_id FROM org_default_roles WHERE org_id=?`, [orgId])
  let roleIds = defs.map(r => Number((r as any).role_id))
  if (roleIds.length === 0) {
    const [[student]] = await pool.query<RowDataPacket[]>(`SELECT id FROM roles WHERE code='student' LIMIT 1`)
    if (!student?.id) throw new Error('默认角色 student 不存在')
    roleIds = [Number(student.id)]
  }
  for (const rid of roleIds) {
    await pool.query(
      `INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at) VALUES (?, ?, ?, NOW())`,
      [userId, orgId, rid]
    )
  }
  return Number(orgId)
}

/** ==== JWT ==== */
const signAccessToken = async (payloadBase: Omit<JwtPayload, 'type' | 'jti'>) =>
  (await getJwt()).sign({ ...payloadBase, type: 'access' }, getJwtSecret(), {
    expiresIn: ACCESS_JWT_EXPIRES_IN,
  } as SignOptions)

const signRefreshToken = async (payloadBase: Omit<JwtPayload, 'type'> & { jti: string }) =>
  (await getJwt()).sign({ ...payloadBase, type: 'refresh' }, getRefreshJwtSecret(), {
    expiresIn: REFRESH_JWT_EXPIRES_IN,
  } as SignOptions)

const computeRefreshExpire = () =>
  new Date(
    Date.now() + (typeof REFRESH_JWT_EXPIRES_IN === 'number' ? REFRESH_JWT_EXPIRES_IN * 1000 : 7 * 24 * 3600 * 1000)
  )

export class AuthService {
  /** 把 refresh 写入 HttpOnly Cookie（名称：rt） */
  setRefreshCookie(res: import('express').Response, token: string) {
    const isProd = process?.env?.NODE_ENV === 'production'
    const maxAgeMs = typeof REFRESH_JWT_EXPIRES_IN === 'number' ? REFRESH_JWT_EXPIRES_IN * 1000 : 7 * 24 * 3600 * 1000

    ;(res as any).cookie?.('rt', token, {
      httpOnly: true,
      secure: isProd, // 跨域请保证 https 并设为 true + sameSite:'none'
      sameSite: 'lax', // 跨域部署改为 'none'
      path: '/api/auth',
      maxAge: maxAgeMs,
    })
  }

  /** 注册：返回 access + refresh + user */
  async register(body: { username?: string; email: string; password: string }) {
    const { username, email, password } = body
    const [existing] = await pool.query<IUser[]>('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) throw new Error('用户已存在')

    const hashed = bcrypt.hashSync(password, 10)
    const [ins] = await pool.query(`INSERT INTO users (username, email, password, status) VALUES (?, ?, ?, 'active')`, [
      username || email.split('@')[0],
      email,
      hashed,
    ])
    const userId = (ins as any).insertId as number

    const orgId = await attachUserToDefaultOrgAndRoles(userId)
    const { roles, role_ids } = await fetchUserRoles(userId)

    const access = await signAccessToken({ id: userId, email, role_ids, roles })
    const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const refresh = await signRefreshToken({ id: userId, email, role_ids, roles, jti })
    await TokenRepository.insertRefresh({
      userId,
      jti,
      token_hash: await sha256(refresh),
      userAgent: undefined,
      ip: undefined,
      expiresAt: computeRefreshExpire(),
    })

    const [userRows] = await pool.query<IUser[]>(
      `SELECT id, username, email, status, created_at, updated_at FROM users WHERE id=?`,
      [userId]
    )
    const user = userRows[0]
    // 返回 refresh，控制器负责写 Cookie
    return { token: access, refresh, user: { ...user, org_id: orgId } } as AuthResponseData & {
      refresh: string
    }
  }

  /** 登录：返回 access + refresh + user */
  async login(email: string, password: string, reqMeta: { ip?: string; ua?: string }) {
    const [users] = await pool.query<IUser[]>('SELECT * FROM users WHERE email = ?', [email])
    if (users.length === 0) {
      await LogRepository.insertLoginLog({
        username: email,
        status: 'failed',
        failureReason: '用户不存在',
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new Error('用户不存在')
    }

    const user = users[0]
    if ((user.status || 'active').toLowerCase() !== 'active') {
      await LogRepository.insertLoginLog({
        userId: user.id,
        username: user.username || user.email,
        status: 'failed',
        failureReason: '账号已被禁用',
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new Error('账号已被禁用，请联系管理员')
    }

    const ok = bcrypt.compareSync(password, user.password)
    if (!ok) {
      await LogRepository.insertLoginLog({
        userId: user.id,
        username: user.username || user.email,
        status: 'failed',
        failureReason: '密码错误',
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new Error('密码错误')
    }

    const [[primary]] = await pool.query<RowDataPacket[]>(
      `SELECT org_id FROM user_organizations WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
      [user.id]
    )
    const orgId = (primary as any)?.org_id ?? null
    const { roles, role_ids } = await fetchUserRoles(user.id)

    const access = await signAccessToken({ id: user.id, email: user.email, role_ids, roles })
    const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const refresh = await signRefreshToken({ id: user.id, email: user.email, role_ids, roles, jti })
    await TokenRepository.insertRefresh({
      userId: user.id,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta.ua || null,
      ip: reqMeta.ip || null,
      expiresAt: computeRefreshExpire(),
    })

    await LogRepository.insertLoginLog({
      userId: user.id,
      username: user.username || user.email,
      status: 'success',
      ipAddress: reqMeta.ip,
      userAgent: reqMeta.ua,
    } as any)

    const { password: _omit, ...userWithoutPwd } = user
    return {
      token: access,
      refresh,
      user: { ...userWithoutPwd, org_id: orgId },
    } as AuthResponseData & { refresh: string }
  }

  /** 刷新：校验 & 轮换 refresh，返回新的 access + refresh */
  async refresh(rt: string) {
    const jwt = await getJwt()
    const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload
    if (payload.type !== 'refresh' || !payload.jti || !payload.id) {
      throw new Error('刷新令牌无效或已过期')
    }

    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM refresh_tokens WHERE jti=? LIMIT 1`, [payload.jti])
    if (rows.length === 0) throw new Error('刷新令牌不存在或已吊销')
    const row: any = rows[0]
    if (row.revoked) throw new Error('刷新令牌已吊销')
    if ((await sha256(rt)) !== row.token_hash) throw new Error('刷新令牌不匹配')
    if (new Date(row.expires_at).getTime() <= Date.now()) throw new Error('刷新令牌已过期')

    const { roles, role_ids } = await fetchUserRoles(payload.id)
    const access = await signAccessToken({ id: payload.id, email: payload.email, role_ids, roles })

    // 轮换 refresh
    const newJti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const newRefresh = await signRefreshToken({
      id: payload.id,
      email: payload.email,
      role_ids,
      roles,
      jti: newJti,
    })
    await TokenRepository.rotate(payload.jti, {
      userId: payload.id,
      jti: newJti,
      token_hash: await sha256(newRefresh),
      userAgent: null,
      ip: null,
      expiresAt: computeRefreshExpire(),
    })

    return { token: access, refresh: newRefresh }
  }

  /** 登出：吊销 refresh（如果能拿到的话） */
  async logout(rt?: string) {
    if (!rt) return
    try {
      const jwt = await getJwt()
      const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload
      if ((payload as any)?.jti) await TokenRepository.revokeByJti((payload as any).jti)
    } catch {
      // 忽略无效/过期
    }
  }

  // 兼容旧控制器
  async sendReset(email: string, resetUrl: string, username: string) {
    await emailService.sendPasswordResetEmail(email, resetUrl, username)
  }
}
