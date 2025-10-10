/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 绝不从 'jsonwebtoken' 做静态导入；运行时用 Function('return require')() 加载。
 * 这样 TypeScript 不会尝试解析 @types/jsonwebtoken，从根上规避 TS2306。
 */
import bcrypt from 'bcryptjs'
import type { AuthResponseData, IUser } from '../domain/auth.model'
import { TokenRepository, sha256 } from '../repositories/token.repository'
import HttpError from '@/common/errors/http-error'
import { UserRepository, OrgRepository } from '../repositories/user.repository'
import { ACCESS_JWT_EXPIRES_IN, REFRESH_JWT_EXPIRES_MS, getJwtSecret, getRefreshJwtSecret } from '@/config/jwt'
import { LogService } from '@/modules/logs/services/log.service'
import { SessionStore } from '@/common/session/session.store'
import { validateStrongPassword } from '@/modules/auth/services/password-policy.service'

declare const process: any

/**
 * 仅在本文件内使用的“够用型”JWT载荷类型，避免引用 @types/jsonwebtoken
 */
type JwtLikePayload = {
  id: number
  email: string
  role_ids: number[]
  roles: any
  type?: 'access' | 'refresh'
  jti?: string
  sid?: string
  prst?: 0 | 1
}

/** 运行时装载 jsonwebtoken（不触发 TS 的模块类型解析） */
function requireJwt(): any {
  try {
    // 在 CJS 环境可直接获得 require；在 ESM 下也能通过此方式拿到
    // eslint-disable-next-line no-new-func
    const req = Function('return require')() as (m: string) => any
    const mod = req('jsonwebtoken')
    return mod && mod.default ? mod.default : mod
  } catch (e) {
    // 如果运行时没装 jsonwebtoken，这里抛错更直观
    throw new Error('jsonwebtoken 模块未安装或无法加载，请执行：pnpm add jsonwebtoken')
  }
}

// —— Access 固定用相对 TTL —— //
const signAccessToken = async (payloadBase: Omit<JwtLikePayload, 'type' | 'jti'>, sid?: string) => {
  const jwt = requireJwt()
  return jwt.sign({ ...payloadBase, type: 'access', sid }, getJwtSecret(), {
    expiresIn: ACCESS_JWT_EXPIRES_IN,
  } as any)
}

// —— Refresh 使用“绝对过期时间”（不滑动续期） —— //
const signRefreshTokenAbs = async (
  payloadBase: Omit<JwtLikePayload, 'type'> & { jti: string; prst: 0 | 1 },
  absExp: Date
) => {
  const now = Date.now()
  const remainSec = Math.max(1, Math.floor((absExp.getTime() - now) / 1000))
  const jwt = requireJwt()
  return jwt.sign({ ...payloadBase, type: 'refresh' }, getRefreshJwtSecret(), {
    expiresIn: remainSec,
  } as any)
}

const computeRefreshAbsExpire = () => new Date(Date.now() + REFRESH_JWT_EXPIRES_MS)

export class AuthService {
  setRefreshCookie(res: import('express').Response, token: string, opts?: { persist?: boolean; maxAgeMs?: number }) {
    const isProd = process?.env?.NODE_ENV === 'production'
    const base: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
    }
    const final =
      typeof opts?.maxAgeMs === 'number'
        ? { ...base, maxAge: Math.max(0, Math.floor(opts!.maxAgeMs)) }
        : opts?.persist
        ? { ...base, maxAge: REFRESH_JWT_EXPIRES_MS }
        : base
    ;(res as any).cookie?.('rt', token, final)
  }

  async register(
    body: { username?: string; email: string; password: string },
    reqMeta?: { ip?: string; ua?: string },
    options?: { persist?: boolean }
  ) {
    const { username, email, password } = body

    await validateStrongPassword(password)

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

    const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const absExp = computeRefreshAbsExpire()
    const prst: 0 | 1 = options?.persist ? 1 : 0
    const refresh = await signRefreshTokenAbs({ id: userId, email, role_ids: ridList, roles, jti, prst }, absExp)
    const access = await signAccessToken({ id: userId, email, role_ids: ridList, roles }, jti)

    await TokenRepository.insertRefresh({
      userId,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta?.ua || null,
      ip: reqMeta?.ip || null,
      expiresAt: absExp,
    })

    await SessionStore.save({
      jti,
      userId,
      username: username || email,
      role: roles?.[0]?.code,
      ip: reqMeta?.ip || null,
      ua: reqMeta?.ua || null,
      loginAt: new Date().toISOString(),
      expAt: Math.floor(absExp.getTime() / 1000),
    })

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
    return {
      token: access,
      refresh,
      user: { ...user, org_id: orgId },
      persist: !!options?.persist,
    } as AuthResponseData & { refresh: string; persist: boolean }
  }

  async login(email: string, password: string, reqMeta: { ip?: string; ua?: string }, options?: { persist?: boolean }) {
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

    const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const absExp = computeRefreshAbsExpire()
    const prst: 0 | 1 = options?.persist ? 1 : 0
    const refresh = await signRefreshTokenAbs(
      { id: user.id, email: user.email, role_ids: roleIds, roles, jti, prst },
      absExp
    )
    const access = await signAccessToken({ id: user.id, email: user.email, role_ids: roleIds, roles }, jti)

    await TokenRepository.insertRefresh({
      userId: user.id,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta.ua || null,
      ip: reqMeta.ip || null,
      expiresAt: absExp,
    })

    await SessionStore.save({
      jti,
      userId: user.id,
      username: user.username || user.email,
      role: roles?.[0]?.code,
      ip: reqMeta?.ip || null,
      ua: reqMeta?.ua || null,
      loginAt: new Date().toISOString(),
      expAt: Math.floor(absExp.getTime() / 1000),
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
    return {
      token: access,
      refresh,
      user: { ...userWithoutPwd },
      persist: !!options?.persist,
    } as AuthResponseData & { refresh: string; persist: boolean }
  }

  /** 刷新：校验 & 轮换 refresh（不延长绝对过期），并同步会话 sid */
  async refresh(rt: string) {
    const jwt = requireJwt()
    const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtLikePayload
    if (payload.type !== 'refresh' || !payload.jti || !payload.id) {
      throw new HttpError('刷新令牌无效或已过期')
    }

    // 会话必须仍处于激活状态
    const stillActive = await SessionStore.isActive(payload.jti)
    if (!stillActive) {
      try {
        await TokenRepository.revokeByJti(payload.jti)
      } catch {}
      throw new HttpError('刷新令牌已失效（会话被强退）')
    }

    const row = await TokenRepository.findByJti(payload.jti)
    if (!row) throw new Error('刷新令牌不存在或已吊销')
    if (row.revoked) throw new Error('刷新令牌已吊销')
    if ((await sha256(rt)) !== row.token_hash) throw new Error('刷新令牌不匹配')

    const now = Date.now()
    const absExpMs = new Date(row.expires_at).getTime()
    const remainMs = absExpMs - now
    if (remainMs <= 0) throw new HttpError('刷新令牌已过期')

    const { roles, roleIds } = await UserRepository.rolesOfUser(payload.id)

    // 轮换 refresh：exp 仍用同一个 absolute（不延长）
    const newJti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const prst: 0 | 1 = (payload as any)?.prst ? 1 : 0
    const newRefresh = await signRefreshTokenAbs(
      { id: payload.id, email: payload.email, role_ids: roleIds, roles, jti: newJti, prst },
      new Date(absExpMs)
    )
    const access = await signAccessToken({ id: payload.id, email: payload.email, role_ids: roleIds, roles }, newJti)

    await TokenRepository.rotate(payload.jti, {
      userId: payload.id,
      jti: newJti,
      token_hash: await sha256(newRefresh),
      userAgent: null,
      ip: null,
      expiresAt: new Date(absExpMs),
    })

    // 同步会话：撤销旧 sid，登记新 sid
    try {
      await SessionStore.revoke(payload.jti)
      await SessionStore.save({
        jti: newJti,
        userId: payload.id,
        username: (await UserRepository.findById(payload.id))?.username || payload.email || String(payload.id),
        role: roles?.[0]?.code,
        ip: null,
        ua: null,
        loginAt: new Date().toISOString(),
        expAt: Math.floor(absExpMs / 1000),
      })
    } catch {}

    return { token: access, refresh: newRefresh, persist: prst === 1, remainMs }
  }

  /** 登出：吊销 refresh，并撤销会话 */
  async logout(rt?: string, reqMeta?: { ip?: string; ua?: string }) {
    if (!rt) return
    try {
      const jwt = requireJwt()
      const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtLikePayload
      if ((payload as any)?.jti) {
        await TokenRepository.revokeByJti((payload as any).jti)
        await SessionStore.revoke((payload as any).jti)
      }

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
