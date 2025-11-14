/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogService } from '@/modules/logs/services/log.service'
import bcrypt from 'bcryptjs'
import type { PoolConnection } from 'mysql2/promise'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'
import { pool } from '@/config/database.js'

// Redis（容错）
let RC: any = null,
  RL: any = null,
  RClient: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default
  } catch {}
  try {
    RL = (await import('@/common/redis/lock')).default
  } catch {}
  try {
    RClient = (await import('@/common/redis/client')).default
  } catch {}
})()

const USER_TTL = 600
const kUserFull = (id: number) => `user:${id}:full`
const kUserMe = (id: number) => `user:${id}:me`
const kUserList = (q: any) => `user:list:${JSON.stringify(q)}`
const kUserSettings = (id: number) => `user:${id}:settings`

// === 关键：cget 不使用泛型，避免 TS2347 ===
async function cget(key: string): Promise<any> {
  try {
    const v = await RC?.get?.(key)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = USER_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}
async function cdelByPattern(p: string) {
  try {
    const ks = await RC?.keys?.(p)
    if (ks?.length) await RC?.del?.(ks)
  } catch {}
}
async function publishToUser(uid: number, payload: any) {
  try {
    await RClient?.publish?.(`ws:user:${uid}`, JSON.stringify(payload))
  } catch {}
}

export class UserService {
  constructor(private readonly repo: UserRepository = new UserRepository()) {}

  // —— 创建：同一事务内完成 —— //
  async adminCreate(
    payload: {
      username?: string
      nickname?: string | null
      email?: string | null
      password: string
      status: UserStatus
      role?: UserRole
      org_id?: number | null
      phone?: string | null
      gender?: '男' | '女' | '保密' | null
      remark?: string | null
    },
    actor?: { id?: number; email?: string },
    req?: any
  ): Promise<UserDTO> {
    const conn: PoolConnection = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 探测 username 列 & 生成 username
      const hasU = await this.repo.hasUsername()
      let finalUsername = payload.username
      if (hasU && !finalUsername) {
        const local = String(payload.email || '').split('@')[0] || 'user'
        const base =
          local
            .trim()
            .toLowerCase()
            .replace(/[\s._]+/g, '-')
            .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'user'
        const rand = Math.random().toString(36).slice(2, 6)
        finalUsername = `${base}-${rand}`
      }

      // —— 唯一性预检（事务内） —— //
      if (await this.repo.existsByEmail(payload.email ?? null, conn)) {
        const err: any = new Error('邮箱已存在')
        err.code = 'ER_DUP_ENTRY'
        throw err
      }
      if (await this.repo.existsByUsername(finalUsername ?? null, conn)) {
        const err: any = new Error('用户名已存在')
        err.code = 'ER_DUP_ENTRY'
        throw err
      }
      if (await this.repo.existsByPhone(payload.phone ?? null, conn)) {
        const err: any = new Error('手机号已存在')
        err.code = 'ER_DUP_ENTRY'
        throw err
      }

      const hashed = await bcrypt.hash(payload.password, 10)

      // —— 插入 users —— //
      const created = await this.repo.createUser(
        {
          username: hasU ? finalUsername : undefined,
          email: payload.email ?? null,
          nickname: payload.nickname ?? null,
          passwordHash: hashed,
          role: payload.role ?? 'student',
          status: payload.status,
          phone: payload.phone ?? null,
          gender: (payload.gender as any) ?? '保密',
          remark: payload.remark ?? null,
        },
        conn
      )

      // —— 关联主组织（可选） —— //
      const nextOrgId = (payload.org_id ?? null) as number | null
      if (nextOrgId !== null && Number.isFinite(nextOrgId)) {
        await this.repo.setPrimaryOrg(created.id, nextOrgId, conn)
      }

      await LogService.log(
        {
          type: 'user',
          userId: actor?.id || 0,
          action: '创建用户',
          resourceType: 'user',
          resourceId: created.id,
          details: { username: created.username, role: created.role, status: created.status, hasUsername: hasU },
        },
        req
      )

      await conn.commit()

      await cdelByPattern('user:list:*')
      return created
    } catch (e) {
      try {
        await conn.rollback()
      } catch {}
      throw e
    } finally {
      conn.release()
    }
  }

  async changePassword(userId: number, current: string, next: string, req?: any) {
    const me = await this.repo.getById(userId)
    if (!me) throw new Error('用户不存在')

    const hashed = await this.repo.getPasswordHash(userId)
    if (!hashed) throw new Error('读取密码失败')

    const pass = bcrypt.compareSync(current, hashed)
    if (!pass) return false

    const newHashed = bcrypt.hashSync(next, 10)
    await this.repo.resetPassword(userId, newHashed)

    await LogService.log(
      { type: 'user', userId, action: '修改密码', resourceType: 'user', resourceId: userId, status: 'success' },
      req
    )

    await cdel(kUserFull(userId), kUserMe(userId))
    await publishToUser(userId, { type: 'password_changed' })
    return true
  }

  private async getPrimaryOrgMeta(userId: number): Promise<{ orgId: number | null; org_name: string | null }> {
    return this.repo.getPrimaryOrgMeta(userId)
  }

  async getById(userId: number) {
    const ck = kUserFull(userId)
    const hit = await cget(ck)
    if (hit) return hit
    const user = await this.repo.getById(userId)
    if (!user) return null
    const stats = await this.repo.statsOfUser(userId)
    const { orgId, org_name } = await this.getPrimaryOrgMeta(userId)
    const out = { ...user, statistics: stats, orgId, org_id: orgId, org_name }
    await cset(ck, out, 600)
    return out
  }

  async getMe(userId: number) {
    const ck = kUserMe(userId)
    const hit = await cget(ck)
    if (hit) return hit
    const me = await this.repo.getById(userId)
    if (me) await cset(ck, me, 600)
    return me
  }

  async list(params: {
    page: number
    limit: number
    role?: UserRole
    search?: string
    email?: string
    nickname?: string
    phone?: string
    status?: UserStatus
  }) {
    const ck = kUserList(params)
    const hit = await cget(ck)
    if (hit) return hit
    const data = await this.repo.list(params)
    await cset(ck, data, 120)
    return data
  }

  async listByOrg(params: {
    orgId: number
    page: number
    limit: number
    role?: string
    search?: string
    includeChildren?: boolean
    email?: string
    nickname?: string
    phone?: string
    status?: UserStatus
  }): Promise<{ items: UserDTO[]; total: number }> {
    // 纯委托到仓储
    return this.repo.listByOrg(params)
  }

  async updateMe(userId: number, patch: Partial<Pick<UserDTO, 'nickname' | 'school' | 'class_name'>>, req?: any) {
    const updated = await this.repo.updateUser(userId, patch as any)
    if (!updated) throw new Error('更新失败')

    await LogService.log(
      {
        type: 'user',
        userId,
        action: '更新个人资料',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { 更新字段: Object.keys(patch) },
      },
      req
    )

    await cdel(kUserFull(userId), kUserMe(userId), kUserSettings(userId))
    await cdelByPattern('user:list:*')
    await publishToUser(userId, { type: 'user_updated' })
    return updated
  }

  private async applyAvatar(userId: number, avatarUrl: string) {
    const updated = await this.repo.updateUser(userId, { avatar_url: avatarUrl })
    if (!updated) throw new Error('更新头像失败')
    await cdel(kUserFull(userId), kUserMe(userId), kUserSettings(userId))
    await cdelByPattern('user:list:*')
    await publishToUser(userId, { type: 'user_updated' })
    return updated
  }

  async uploadAvatar(userId: number, avatarUrl: string, req?: any) {
    const updated = await this.applyAvatar(userId, avatarUrl)

    await LogService.log(
      {
        type: 'user',
        userId,
        action: '上传头像',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { 头像地址: avatarUrl },
      },
      req
    )

    return updated
  }

  async adminUploadAvatar(
    targetUserId: number,
    avatarUrl: string,
    actor?: { id?: number; email?: string },
    req?: any
  ) {
    const updated = await this.applyAvatar(targetUserId, avatarUrl)

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        action: '管理员上传用户头像',
        resourceType: 'user',
        resourceId: Number(targetUserId),
        details: { 头像地址: avatarUrl, 操作者: actor },
      },
      req
    )

    return updated
  }

  async adminUpdate(
    targetUserId: number,
    patch: Partial<
      Pick<
        UserDTO,
        | 'username'
        | 'email'
        | 'role'
        | 'avatar_url'
        | 'nickname'
        | 'school'
        | 'class_name'
        | 'phone'
        | 'gender'
        | 'remark'
      >
    >,
    actor?: { id?: number; email?: string },
    req?: any
  ) {
    const updated = await this.repo.updateUser(targetUserId, patch)
    if (!updated) throw new Error('用户不存在')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        action: '管理员修改用户信息',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 修改字段: Object.keys(patch) },
      },
      req
    )

    await Promise.all([
      cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId)),
      cdelByPattern('user:list:*'),
      cdelByPattern(`perm:${targetUserId}:*`),
      cdelByPattern(`menuTree:${targetUserId}:*`),
      publishToUser(targetUserId, { type: 'user_updated' }),
    ])

    return updated
  }

  async updateStatus(targetUserId: number, status: UserStatus, actor?: { id?: number; email?: string }, req?: any) {
    const updated = await this.repo.updateStatus(targetUserId, status)
    if (!updated) throw new Error('更新用户状态失败')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        action: '修改用户状态',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 新状态: status },
      },
      req
    )

    await cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId))
    await cdelByPattern('user:list:*')
    await cdelByPattern(`perm:${targetUserId}:*`)
    await cdelByPattern(`menuTree:${targetUserId}:*`)
    await publishToUser(targetUserId, { type: 'user_updated' })
  }

  async resetPassword(
    targetUserId: number,
    actor?: { id?: number; email?: string },
    req?: any,
    options?: { newPassword?: string; forceLogout?: boolean }
  ) {
    const defaultPassword =
      (typeof process !== 'undefined' ? (process as any)?.env?.DEFAULT_RESET_PASSWORD : undefined) || 'ChangeMe123!'
    const plain = options?.newPassword || defaultPassword

    const exec = async () => {
      const hashed = await bcrypt.hash(plain, 10)
      const ok = await this.repo.resetPassword(targetUserId, hashed)
      if (!ok) throw new Error('RESET_NOT_APPLIED')

      await LogService.log(
        {
          type: 'user',
          userId: actor?.id || 0,
          action: '重置用户密码',
          resourceType: 'user',
          resourceId: targetUserId,
          details: { 是否自定义: !!options?.newPassword },
        },
        req
      )

      await cdel(kUserFull(targetUserId), kUserMe(targetUserId))
      await publishToUser(targetUserId, { type: 'password_reset' })
      return plain
    }

    const withLock = RL?.withLock as
      | undefined
      | ((k: string, ttlSeconds: number, fn: () => Promise<any>) => Promise<any>)
    if (!withLock) return exec()

    const key = `lock:user:reset:${targetUserId}`
    const ttlSeconds = 3
    const maxAttempts = 5
    const baseDelayMs = 120

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await withLock(key, ttlSeconds, exec)
      } catch (err: any) {
        const busy = err?.message === 'LOCK_BUSY' || err?.code === 'LOCK_BUSY'
        if (!busy) throw err
        await new Promise(r => setTimeout(r, baseDelayMs * attempt))
      }
    }
    return exec()
  }

  async deleteUser(targetUserId: number, targetRole: UserRole, actor?: { id?: number; email?: string }, req?: any) {
    if (targetRole === 'admin') throw new Error('管理员账号不允许删除')
    await this.deleteUsers([targetUserId], actor, req)
  }

  async setUserOrg(targetUserId: number, nextOrgId: number | null, _actor?: { id?: number; email?: string }) {
    if (!(nextOrgId === null || Number.isFinite(nextOrgId))) return
    await this.repo.setPrimaryOrg(targetUserId, nextOrgId)
    await cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId))
    await cdelByPattern('user:list:*')
    await cdelByPattern(`perm:${targetUserId}:*`)
    await cdelByPattern(`menuTree:${targetUserId}:*`)
    await publishToUser(targetUserId, { type: 'user_updated' })
  }

  async getSettings(userId: number): Promise<UserSettings> {
    const ck = kUserSettings(userId)
    // 不用泛型，改断言，彻底规避 TS2347
    const hit = (await cget(ck)) as UserSettings | null
    if (hit) return hit
    const s = ((await this.repo.getSettings(userId)) as UserSettings | null) || {
      notifications: { email: true, push: true, sound: true },
      privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
      appearance: { theme: 'light', language: 'zh-CN' },
    }
    await cset(ck, s, 3600)
    return s
  }

  async saveSettings(userId: number, settings: UserSettings, req?: any) {
    await this.repo.saveSettings(userId, settings)
    await LogService.log(
      {
        type: 'user',
        userId,
        action: '保存个人设置',
        resourceType: 'user_settings',
        resourceId: userId,
        details: { 变更项: Object.keys(settings || {}) },
      },
      req
    )

    await cdel(kUserFull(userId), kUserMe(userId), kUserSettings(userId))
    await cdelByPattern('user:list:*')
    await publishToUser(userId, { type: 'user_updated' })
    return settings
  }

  // —— 批量删除（跳过管理员） —— //
  async deleteUsers(targetUserIds: number[], actor?: { id?: number; email?: string }, req?: any) {
    if (!targetUserIds.length) return { deleted: 0, skipped: [] as number[] }

    const pairs = await this.repo.getRolesForUserIds(targetUserIds)
    const skipAdmins = pairs.filter(p => p.role === 'admin').map(p => p.id)
    const toDelete = targetUserIds.filter(id => !skipAdmins.includes(id))

    const deleted = await this.repo.deleteUsers(toDelete)

    for (const id of toDelete) {
      await LogService.log(
        { type: 'user', userId: actor?.id || 0, action: '删除用户', resourceType: 'user', resourceId: id },
        req
      )
    }

    try {
      for (const id of toDelete) {
        await Promise.all([
          cdel(`user:${id}:full`, `user:${id}:me`, `user:${id}:settings`),
          cdelByPattern(`user:list:*`),
          cdelByPattern(`perm:${id}:*`),
          cdelByPattern(`menuTree:${id}:*`),
          publishToUser(id, { type: 'user_deleted' }),
        ])
      }
    } catch {}

    return { deleted, skipped: skipAdmins }
  }
}

export default UserService
