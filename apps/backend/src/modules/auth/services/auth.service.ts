/* eslint-disable @typescript-eslint/no-explicit-any */
import { ACCESS_JWT_EXPIRES_IN, REFRESH_JWT_EXPIRES_IN, getJwtSecret, getRefreshJwtSecret } from '@/config/jwt'
import { emailService } from '@/infrastructure/email/email.service'
import { LogService } from '@/modules/logs/services/log.service'
import bcrypt from 'bcryptjs'
import type { AuthResponseData, JwtPayload, JwtRole, IUser } from '../domain/auth.model'
import { TokenRepository, sha256 } from '../repositories/token.repository'
import HttpError from '@/common/errors/http-error'
import { UserRepository, OrgRepository } from '../repositories/user.repository'

declare const process: any

// 动态加载 jsonwebtoken，避免类型“不是模块”的编译问题
async function getJwt(): Promise<any> {
  const mod: any = await import('jsonwebtoken')
  return mod?.default ?? mod
}

const signAccessToken = async (payloadBase: Omit<JwtPayload, 'type' | 'jti'>) =>
  (await getJwt()).sign({ ...payloadBase, type: 'access' }, getJwtSecret(), {
    expiresIn: ACCESS_JWT_EXPIRES_IN,
  } as any)

const signRefreshToken = async (payloadBase: Omit<JwtPayload, 'type'> & { jti: string }) =>
  (await getJwt()).sign({ ...payloadBase, type: 'refresh' }, getRefreshJwtSecret(), {
    expiresIn: REFRESH_JWT_EXPIRES_IN,
  } as any)

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
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: maxAgeMs,
    })
  }

  /** 注册：返回 access + refresh + user（日志带 IP/UA） */
  async register(body: { username?: string; email: string; password: string }, reqMeta?: { ip?: string; ua?: string }) {
    const { username, email, password } = body
    await validateStrongPassword(password) // ✅ 强密码校验

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
    const refresh = await signRefreshToken({ id: userId, email, role_ids: ridList, roles, jti })
    await TokenRepository.insertRefresh({
      userId,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta?.ua || null,
      ip: reqMeta?.ip || null,
      expiresAt: computeRefreshExpire(),
    })

    await LogService.log({
      type: 'user',
      status: 'success',
      userId,
      username: username || email,
      action: '注册账号',
      resourceType: 'user',
      resourceId: userId,
      details: { email },
      message: '用户注册成功',
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    } as any)

    const user = (await UserRepository.findById(userId)) as IUser
    return { token: access, refresh, user: { ...user, org_id: orgId } } as AuthResponseData & { refresh: string }
  }

  /** 登录：返回 access + refresh + user（日志带 IP/UA） */
  async login(email: string, password: string, reqMeta: { ip?: string; ua?: string }) {
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
    const refresh = await signRefreshToken({ id: user.id, email: user.email, role_ids: roleIds, roles, jti })
    await TokenRepository.insertRefresh({
      userId: user.id,
      jti,
      token_hash: await sha256(refresh),
      userAgent: reqMeta.ua || null,
      ip: reqMeta.ip || null,
      expiresAt: computeRefreshExpire(),
    })

    await LogService.log({
      type: 'login',
      status: 'success',
      userId: user.id,
      username: user.username || user.email,
      action: '登录',
      message: '登录成功',
      ipAddress: reqMeta.ip,
      userAgent: reqMeta.ua,
    } as any)

    const { password: _omit, ...userWithoutPwd } = user
    return { token: access, refresh, user: { ...userWithoutPwd } } as AuthResponseData & { refresh: string }
  }

  /** 刷新：校验 & 轮换 refresh，返回新的 access + refresh */
  async refresh(rt: string) {
    const jwt = await getJwt()
    const payload = jwt.verify(rt, getRefreshJwtSecret()) as JwtPayload
    if (payload.type !== 'refresh' || !payload.jti || !payload.id) throw new HttpError('刷新令牌无效或已过期')

    const row = await TokenRepository.findByJti(payload.jti)
    if (!row) throw new Error('刷新令牌不存在或已吊销')
    if (row.revoked) throw new Error('刷新令牌已吊销')
    if ((await sha256(rt)) !== row.token_hash) throw new Error('刷新令牌不匹配')
    if (new Date(row.expires_at).getTime() <= Date.now()) throw new HttpError('刷新令牌已过期')

    const { roles, roleIds } = await UserRepository.rolesOfUser(payload.id)
    const access = await signAccessToken({ id: payload.id, email: payload.email, role_ids: roleIds, roles })

    // 轮换 refresh
    const newJti = (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2)
    const newRefresh = await signRefreshToken({
      id: payload.id,
      email: payload.email,
      role_ids: roleIds,
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
