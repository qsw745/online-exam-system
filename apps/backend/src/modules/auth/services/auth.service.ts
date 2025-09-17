/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs'
import type { AuthResponseData, JwtPayload, IUser } from '../domain/auth.model'
import { TokenRepository, sha256 } from '../repositories/token.repository'
import HttpError from '@/common/errors/http-error'
import { UserRepository, OrgRepository } from '../repositories/user.repository'
import {
  ACCESS_JWT_EXPIRES_IN,
  REFRESH_JWT_EXPIRES_IN,
  ACCESS_JWT_EXPIRES_MS,
  REFRESH_JWT_EXPIRES_MS,
  getJwtSecret,
  getRefreshJwtSecret,
} from '@/config/jwt'
import { LogService } from '@/modules/logs/services/log.service'

// 如果你项目里有强密码校验，请解注以下导入并调用；没有就可忽略。
// import { validateStrongPassword } from '@/modules/auth/services/password-policy.service'

declare const process: any

// 动态加载 jsonwebtoken，避免类型“不是模块”的编译问题
async function getJwt(): Promise<any> {
  const mod: any = await import('jsonwebtoken')
  return mod?.default ?? mod
}

// —— Access 固定用相对 TTL —— //
const signAccessToken = async (payloadBase: Omit<JwtPayload, 'type' | 'jti'>) =>
    (await getJwt()).sign({ ...payloadBase, type: 'access' }, getJwtSecret(), {
      expiresIn: ACCESS_JWT_EXPIRES_IN, // seconds
    } as any)

// —— Refresh 使用“绝对过期时间”（不滑动续期） —— //
// prst: 1/0 表示是否持久化 Cookie（7天免登录）
const signRefreshTokenAbs = async (
    payloadBase: Omit<JwtPayload, 'type'> & { jti: string; prst: 0 | 1 },
    absExp: Date
) => {
  const now = Date.now()
  const remainSec = Math.max(1, Math.floor((absExp.getTime() - now) / 1000))
  return (await getJwt()).sign({ ...payloadBase, type: 'refresh' }, getRefreshJwtSecret(), {
    expiresIn: remainSec, // seconds to absolute deadline
  } as any)
}

// 仅供首次签发：统一用毫秒常量
const computeRefreshAbsExpire = () => new Date(Date.now() + REFRESH_JWT_EXPIRES_MS)

export class AuthService {
  /** 把 refresh 写入 HttpOnly Cookie（名称：rt） */
  setRefreshCookie(
      res: import('express').Response,
      token: string,
      opts?: { persist?: boolean; maxAgeMs?: number }
  ) {
    const isProd = process?.env?.NODE_ENV === 'production'
    const base: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
    }
    // 有 maxAgeMs 就用剩余毫秒；否则如果 persist=true 用完整 TTL；否则会话 Cookie
    const final =
        typeof opts?.maxAgeMs === 'number'
            ? { ...base, maxAge: Math.max(0, Math.floor(opts!.maxAgeMs)) }
            : opts?.persist
                ? { ...base, maxAge: REFRESH_JWT_EXPIRES_MS }
                : base
    ;(res as any).cookie?.('rt', token, final)
  }

  /** 注册：返回 access + refresh + user（日志带 IP/UA） */
  async register(
      body: { username?: string; email: string; password: string },
      reqMeta?: { ip?: string; ua?: string },
      options?: { persist?: boolean } // 控制是否持久 Cookie（7 天免登录）
  ) {
    const { username, email, password } = body

    // 如有强密码策略，放开此行
    // await validateStrongPassword(password)

    const existed = await UserRepository.findByEmail(email)
    if (existed) throw new Error('用户已存在')

    const hashed = bcrypt.hashSync(password, 10)
    const userId = await UserRepository.insertUser(username || email.split('@')[0], email, hashed)

    const orgId = await OrgRepository.getDefaultOrgId()
    await OrgRepository.attachUserToOrg(userId, orgId)

    let roleIds = await OrgRepository.defaultRoleIdsOfOrg(orgId)
    if (roleIds.length === 0) {
      const studentId = await OrgRepository.findRoleIdByCode('student')
      if (!studentId) throw new Error('默认角色 student 不存在')
      roleIds = [studentId]
    }
    await OrgRepository.ensureUserRoles(userId, orgId, roleIds)

    const { roles, roleIds: ridList } = await UserRepository.rolesOfUser(userId)
    const access = await signAccessToken({ id: userId, email, role_ids: ridList, roles })

    const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const absExp = computeRefreshAbsExpire()
    const prst: 0 | 1 = options?.persist ? 1 : 0
    const refresh = await signRefreshTokenAbs({ id: userId, email, role_ids: ridList, roles, jti, prst }, absExp)

    await TokenRepository.insertRefresh({
      userId,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta?.ua || null,
      ip: reqMeta?.ip || null,
      expiresAt: absExp, // 绝对过期
    })

    // 业务日志
    await LogService.log({
      type: 'user',
      status: 'success',
      userId,
      username: username || email,
      action: '注册账号',
      resourceType: 'user',
      resourceId: userId,
      details: { email, persist: !!options?.persist },
      message: '用户注册成功',
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)

    const user = (await UserRepository.findById(userId)) as IUser
    return { token: access, refresh, user: { ...user, org_id: orgId }, persist: !!options?.persist } as
        AuthResponseData & { refresh: string; persist: boolean }
  }

  /** 登录：返回 access + refresh + user（日志带 IP/UA） */
  async login(
      email: string,
      password: string,
      reqMeta: { ip?: string; ua?: string },
      options?: { persist?: boolean }
  ) {
    const user = await UserRepository.findByEmail(email)
    if (!user) {
      await LogService.log({
        type: 'login',
        status: 'failed',
        username: email,
        action: '登录',
        message: '登录失败：用户不存在',
        details: { reason: '用户不存在' },
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new HttpError('用户不存在')
    }

    if ((user.status || 'active').toLowerCase() !== 'active') {
      await LogService.log({
        type: 'login',
        status: 'failed',
        userId: user.id,
        username: user.username || user.email,
        action: '登录',
        message: '登录失败：账号被禁用',
        details: { reason: '账号已被禁用' },
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new HttpError('账号已被禁用，请联系管理员')
    }

    const ok = bcrypt.compareSync(password, user.password)
    if (!ok) {
      await LogService.log({
        type: 'login',
        status: 'failed',
        userId: user.id,
        username: user.username || user.email,
        action: '登录',
        message: '登录失败：密码错误',
        details: { reason: '密码错误' },
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new HttpError('用户名或密码错误')
    }

    const { roles, roleIds } = await UserRepository.rolesOfUser(user.id)
    const access = await signAccessToken({ id: user.id, email: user.email, role_ids: roleIds, roles })

    const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const absExp = computeRefreshAbsExpire()
    const prst: 0 | 1 = options?.persist ? 1 : 0
    const refresh = await signRefreshTokenAbs(
        { id: user.id, email: user.email, role_ids: roleIds, roles, jti, prst },
        absExp
    )

    await TokenRepository.insertRefresh({
      userId: user.id,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta.ua || null,
      ip: reqMeta.ip || null,
      expiresAt: absExp, // 绝对过期
    })

    await LogService.log({
      type: 'login',
      status: 'success',
      userId: user.id,
      username: user.username || user.email,
      action: '登录',
      message: '登录成功',
      details: { persist: !!options?.persist },
      ipAddress: reqMeta.ip,
      userAgent: reqMeta.ua,
    } as any)

    const { password: _omit, ...userWithoutPwd } = user
    return { token: access, refresh, user: { ...userWithoutPwd }, persist: !!options?.persist } as
        AuthResponseData & { refresh: string; persist: boolean }
  }

  /** 刷新：校验 & 轮换 refresh（不延长绝对过期） */
  async refresh(rt: string) {
    const jwt = await getJwt()
    const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload & { prst?: 0 | 1 }
    if (payload.type !== 'refresh' || !payload.jti || !payload.id) throw new HttpError('刷新令牌无效或已过期')

    const row = await TokenRepository.findByJti(payload.jti)
    if (!row) throw new Error('刷新令牌不存在或已吊销')
    if (row.revoked) throw new Error('刷新令牌已吊销')
    if ((await sha256(rt)) !== row.token_hash) throw new Error('刷新令牌不匹配')

    const now = Date.now()
    const absExpMs = new Date(row.expires_at).getTime()
    const remainMs = absExpMs - now
    if (remainMs <= 0) throw new HttpError('刷新令牌已过期')

    const { roles, roleIds } = await UserRepository.rolesOfUser(payload.id)
    const access = await signAccessToken({ id: payload.id, email: payload.email, role_ids: roleIds, roles })

    // 轮换 refresh：exp 仍用同一个 absolute（不延长）
    const newJti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const prst: 0 | 1 = (payload as any)?.prst ? 1 : 0
    const newRefresh = await signRefreshTokenAbs(
        { id: payload.id, email: payload.email, role_ids: roleIds, roles, jti: newJti, prst },
        new Date(absExpMs)
    )

    await TokenRepository.rotate(payload.jti, {
      userId: payload.id,
      jti: newJti,
      token_hash: await sha256(newRefresh),
      userAgent: null,
      ip: null,
      expiresAt: new Date(absExpMs), // 沿用原 absolute
    })

    return { token: access, refresh: newRefresh, persist: prst === 1, remainMs } // 带回 persist/剩余毫秒
  }

  /** 登出：吊销 refresh（如果能拿到的话） */
  async logout(rt?: string, reqMeta?: { ip?: string; ua?: string }) {
    if (!rt) return
    try {
      const jwt = await getJwt()
      const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload
      if ((payload as any)?.jti) await TokenRepository.revokeByJti((payload as any).jti)

      await LogService.log({
        type: 'user',
        action: '登出',
        status: 'success',
        message: '用户登出成功',
        userId: payload.id,
        ipAddress: reqMeta?.ip,
        userAgent: reqMeta?.ua,
      } as any)
    } catch {
      // ignore invalid/expired
    }
  }
}
