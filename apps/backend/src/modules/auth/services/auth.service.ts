/* eslint-disable @typescript-eslint/no-explicit-any */
import HttpError from '@/common/errors/http-error'
import { SessionStore } from '@/common/session/session.store'
import { ACCESS_JWT_EXPIRES_IN, REFRESH_JWT_EXPIRES_MS, getJwtSecret, getRefreshJwtSecret } from '@/config/jwt'
import { validateStrongPassword } from '@/modules/auth/services/password-policy.service'
import { LogService } from '@/modules/logs/services/log.service'
import { AdminSettingsService } from '@/modules/admin-settings/services/admin-settings.service'
import { EmailVerificationService } from './email-verification.service'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import type { AuthResponseData, IUser } from '../domain/auth.model'
import { TokenRepository, sha256 } from '../repositories/token.repository'
import { OrgRepository, UserRepository } from '../repositories/user.repository'
import { pool } from '@/config/database'
import type { OAuthProfile } from '@/modules/auth/services/oauth.service'

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

let _jwtMod: any | null = null
async function getJwt(): Promise<any> {
  if (_jwtMod) return _jwtMod
  try {
    const mod: any = await import('jsonwebtoken')
    _jwtMod = mod?.default ?? mod
    return _jwtMod
  } catch {
    throw new Error('jsonwebtoken 模块未安装或无法加载，请在 apps/backend 执行：pnpm add jsonwebtoken')
  }
}
async function ensureJwtReady(): Promise<void> {
  const jwt = await getJwt()
  if (!jwt || typeof jwt.sign !== 'function') {
    throw new Error('jsonwebtoken 模块未安装或无法加载，请在 apps/backend 执行：pnpm add jsonwebtoken')
  }
}
const computeRefreshAbsExpire = () => new Date(Date.now() + REFRESH_JWT_EXPIRES_MS)
const signAccessToken = async (payloadBase: Omit<JwtLikePayload, 'type' | 'jti'>, sid?: string) => {
  const jwt = await getJwt()
  return jwt.sign({ ...payloadBase, type: 'access', sid }, getJwtSecret(), { expiresIn: ACCESS_JWT_EXPIRES_IN } as any)
}
const signRefreshTokenAbs = async (
  payloadBase: Omit<JwtLikePayload, 'type'> & { jti: string; prst: 0 | 1 },
  absExp: Date
) => {
  const now = Date.now()
  const remainSec = Math.max(1, Math.floor((absExp.getTime() - now) / 1000))
  const jwt = await getJwt()
  return jwt.sign({ ...payloadBase, type: 'refresh' }, getRefreshJwtSecret(), { expiresIn: remainSec } as any)
}

export class AuthService {
  setRefreshCookie(res: import('express').Response, token: string, opts?: { persist?: boolean; maxAgeMs?: number }) {
    const isProd = process?.env?.NODE_ENV === 'production'
    const base: any = { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' }
    const final =
      typeof opts?.maxAgeMs === 'number'
        ? { ...base, maxAge: Math.max(0, Math.floor(opts!.maxAgeMs)) }
        : opts?.persist
        ? { ...base, maxAge: REFRESH_JWT_EXPIRES_MS }
        : base
    ;(res as any).cookie?.('rt', token, final)
  }

  clearRefreshCookie(res: import('express').Response) {
    ;(res as any).clearCookie?.('rt', { path: '/' })
    ;(res as any).clearCookie?.('rt', { path: '/api/auth' })
    ;(res as any).clearCookie?.('rt', { path: '/exam/api/auth' })
  }

  private async ensureActiveUser(user: IUser, reqMeta?: { ip?: string; ua?: string }, messagePrefix = '登录') {
    if ((user.status || 'active').toLowerCase() === 'active') return
    await LogService.log({
      type: 'login',
      status: 'failed',
      userId: user.id,
      action: messagePrefix,
      message: `${messagePrefix}失败：账号被禁用`,
      details: { reason: '账号已被禁用', email: user.email },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)
    throw new HttpError('账号已被禁用，请联系管理员')
  }

  private async issueSession(
    user: IUser,
    reqMeta: { ip?: string; ua?: string },
    options?: { persist?: boolean; logAction?: string; logDetails?: Record<string, any> }
  ) {
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
      account: user.email,
      role: roles?.[0]?.code,
      ip: reqMeta?.ip || null,
      ua: reqMeta?.ua || null,
      loginAt: new Date().toISOString(),
      expAt: Math.floor(absExp.getTime() / 1000),
    } as any)

    await LogService.log({
      type: 'login',
      status: 'success',
      userId: user.id,
      action: options?.logAction || '登录',
      message: `${options?.logAction || '登录'}成功`,
      details: { persist: !!options?.persist, email: user.email, ...(options?.logDetails || {}) },
      ipAddress: reqMeta.ip,
      userAgent: reqMeta.ua,
    } as any)

    const { password: _omit, ...userWithoutPwd } = user as any
    return { token: access, refresh, user: { ...userWithoutPwd }, persist: !!options?.persist } as AuthResponseData & {
      refresh: string
      persist: boolean
    }
  }

  async register(
    body: { email: string; password: string; nickname?: string | null },
    reqMeta?: { ip?: string; ua?: string },
    options?: { persist?: boolean }
  ) {
    await ensureJwtReady()

    let createdUserId: number | null = null
    try {
      const { email, password, nickname } = body
      await validateStrongPassword(password)

      const existed = await UserRepository.findByEmail(email)
      if (existed) throw new Error('用户已存在')

      const hashed = bcrypt.hashSync(password, 10)

      const ins = await UserRepository.insertUser({ email, hashed, nickname: nickname ?? null })
      createdUserId = ins.id

      const orgId = await OrgRepository.getDefaultOrgId()
      await OrgRepository.attachUserToOrg(ins.id, orgId)

      let roleIds = await OrgRepository.defaultRoleIdsOfOrg(orgId)
      if (roleIds.length === 0) {
        const studentId = await OrgRepository.findRoleIdByCode('student')
        if (!studentId) throw new Error('默认角色 student 不存在')
        roleIds = [studentId]
      }
      await OrgRepository.ensureUserRoles(ins.id, orgId, roleIds)

      const { roles, roleIds: ridList } = await UserRepository.rolesOfUser(ins.id)

      // 若后台开启了"注册需邮箱验证"：发验证邮件、不自动登录
      const settings = await AdminSettingsService.getSafe().catch(() => ({}) as any)
      if ((settings as any).requireEmailVerification) {
        await EmailVerificationService.issue(ins.id, email, nickname ?? email)
        await LogService.log({
          type: 'user',
          status: 'success',
          userId: ins.id,
          action: '注册账号',
          resourceType: 'user',
          resourceId: ins.id,
          details: { email, requireEmailVerification: true },
          message: '用户注册成功，待邮箱验证',
          ipAddress: reqMeta?.ip,
          userAgent: reqMeta?.ua,
        } as any)
        return { needVerification: true as const, email }
      }

      const jti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
      const absExp = new Date(Date.now() + REFRESH_JWT_EXPIRES_MS)
      const prst: 0 | 1 = options?.persist ? 1 : 0

      const refresh = await signRefreshTokenAbs({ id: ins.id, email, role_ids: ridList, roles, jti, prst }, absExp)
      const access = await signAccessToken({ id: ins.id, email, role_ids: ridList, roles }, jti)

      await TokenRepository.insertRefresh({
        userId: ins.id,
        jti,
        token_hash: await sha256(refresh),
        userAgent: reqMeta?.ua || null,
        ip: reqMeta?.ip || null,
        expiresAt: absExp,
      })

      await SessionStore.save({
        jti,
        userId: ins.id,
        account: email, // 统一用 account 命名，避免 username
        role: roles?.[0]?.code,
        ip: reqMeta?.ip || null,
        ua: reqMeta?.ua || null,
        loginAt: new Date().toISOString(),
        expAt: Math.floor(absExp.getTime() / 1000),
      } as any)

      await LogService.log({
        type: 'user',
        status: 'success',
        userId: ins.id,
        action: '注册账号',
        resourceType: 'user',
        resourceId: ins.id,
        details: { email, persist: !!options?.persist },
        message: '用户注册成功',
        ipAddress: reqMeta?.ip,
        userAgent: reqMeta?.ua,
      } as any)

      const user = (await UserRepository.findById(ins.id)) as IUser
      return { token: access, refresh, user: { ...user, org_id: orgId }, persist: !!options?.persist }
    } catch (e: any) {
      // 唯一键冲突处理
      if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || /duplicate entry/i.test(String(e.message || '')))) {
        if (
          String(e.message || '')
            .toLowerCase()
            .includes('email')
        ) {
          const err = new Error('邮箱已被占用') as any
          err.__field__ = 'email'
          throw err
        }
      }

      // —— 补偿回滚 —— //
      if (createdUserId) {
        try {
          await (pool as any).execute(`DELETE FROM user_org_roles WHERE user_id=?`, [createdUserId])
          await (pool as any).execute(`DELETE FROM user_organizations WHERE user_id=?`, [createdUserId])
          await (pool as any).execute(`DELETE FROM refresh_tokens WHERE user_id=?`, [createdUserId])
          await (pool as any).execute(`DELETE FROM users WHERE id=?`, [createdUserId])
        } catch {}
      }
      throw e
    }
  }

  /** 登录：只支持邮箱 */
  async login(email: string, password: string, reqMeta: { ip?: string; ua?: string }, options?: { persist?: boolean }) {
    await ensureJwtReady()

    const loginNorm = String(email || '').trim()
    const user = await UserRepository.findByLogin(loginNorm)
    if (!user) {
      await LogService.log({
        type: 'login',
        status: 'failed',
        action: '登录',
        message: '登录失败：用户不存在',
        details: { reason: '用户不存在', email: loginNorm },
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new HttpError('用户不存在')
    }

    await this.ensureActiveUser(user, reqMeta, '登录')

    const ok = bcrypt.compareSync(String(password ?? ''), String((user as any).password ?? ''))
    if (!ok) {
      await LogService.log({
        type: 'login',
        status: 'failed',
        userId: user.id,
        action: '登录',
        message: '登录失败：密码错误',
        details: { reason: '密码错误', email: user.email },
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new HttpError('邮箱或密码错误')
    }

    // 后台开启邮箱验证且该账号未验证 → 拦截登录
    const settings = await AdminSettingsService.getSafe().catch(() => ({}) as any)
    if ((settings as any).requireEmailVerification && !(user as any).email_verified) {
      await LogService.log({
        type: 'login',
        status: 'failed',
        userId: user.id,
        action: '登录',
        message: '登录失败：邮箱未验证',
        details: { reason: '邮箱未验证', email: user.email },
        ipAddress: reqMeta.ip,
        userAgent: reqMeta.ua,
      } as any)
      throw new HttpError('邮箱未验证，请先到注册邮箱完成验证后再登录')
    }

    return this.issueSession(user, reqMeta, { persist: !!options?.persist })
  }

  /** 人脸登录：身份已由人脸比对验证通过，这里只做账号有效性校验并签发会话 */
  async loginByFace(
    email: string,
    reqMeta: { ip?: string; ua?: string },
    options?: { persist?: boolean; similarity?: number }
  ) {
    await ensureJwtReady()
    const user = await UserRepository.findByLogin(String(email || '').trim())
    if (!user) throw new HttpError('用户不存在')
    await this.ensureActiveUser(user, reqMeta, '人脸登录')
    return this.issueSession(user, reqMeta, {
      persist: !!options?.persist,
      logAction: '人脸登录',
      logDetails: { similarity: options?.similarity },
    })
  }

  async loginWithOAuth(profile: OAuthProfile, reqMeta: { ip?: string; ua?: string }, options?: { persist?: boolean }) {
    await ensureJwtReady()
    if (!profile.emailVerified) throw new HttpError('第三方账号邮箱未验证')

    const attachDefaultOrgAndRoles = async (userId: number) => {
      const orgId = await OrgRepository.getDefaultOrgId()
      await OrgRepository.attachUserToOrg(userId, orgId)

      let roleIds = await OrgRepository.defaultRoleIdsOfOrg(orgId)
      if (roleIds.length === 0) {
        const studentId = await OrgRepository.findRoleIdByCode('student')
        if (!studentId) throw new Error('默认角色 student 不存在')
        roleIds = [studentId]
      }
      await OrgRepository.ensureUserRoles(userId, orgId, roleIds)
    }

    let user = await UserRepository.findByOAuth(profile.provider, profile.providerUserId)
    if (!user) {
      user = await UserRepository.findByEmail(profile.email)
    }

    if (!user) {
      try {
        const randomPassword = randomBytes(32).toString('base64url')
        const hashed = bcrypt.hashSync(randomPassword, 10)
        const ins = await UserRepository.insertUser({
          email: profile.email,
          hashed,
          nickname: profile.displayName ?? null,
        })
        await attachDefaultOrgAndRoles(ins.id)
        user = (await UserRepository.findById(ins.id)) as IUser
      } catch (e: any) {
        const duplicate = e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || /duplicate entry/i.test(String(e?.message || ''))
        if (!duplicate) throw e
        user = await UserRepository.findByEmail(profile.email)
        if (!user) throw new HttpError('用户创建失败，请重试')
        await attachDefaultOrgAndRoles(user.id)
      }
    }

    await this.ensureActiveUser(user, reqMeta, '第三方登录')
    await UserRepository.upsertOAuthAccount({
      userId: user.id,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
    })

    return this.issueSession(user, reqMeta, {
      persist: !!options?.persist,
      logAction: '第三方登录',
      logDetails: { provider: profile.provider },
    })
  }

  async refresh(rt: string) {
    const jwt = await getJwt()
    const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtLikePayload
    if (payload.type !== 'refresh' || !payload.jti || !payload.id) {
      throw new HttpError('刷新令牌无效或已过期')
    }

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

    const absExpMs = new Date(row.expires_at).getTime()
    const remainMs = absExpMs - Date.now()
    if (remainMs <= 0) throw new HttpError('刷新令牌已过期')

    const { roles, roleIds } = await UserRepository.rolesOfUser(payload.id)

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

    try {
      await SessionStore.revoke(payload.jti)
      const u = await UserRepository.findById(payload.id)
      await SessionStore.save({
        jti: newJti,
        userId: payload.id,
        account: (u?.email || String(payload.id)) as string,
        role: roles?.[0]?.code,
        ip: null,
        ua: null,
        loginAt: new Date().toISOString(),
        expAt: Math.floor(absExpMs / 1000),
      } as any)
    } catch {}

    return { token: access, refresh: newRefresh, persist: prst === 1, remainMs }
  }

  async logout(rt?: string, reqMeta?: { ip?: string; ua?: string }) {
    if (!rt) return
    try {
      const jwt = await getJwt()
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
      /* ignore invalid/expired */
    }
  }
}
