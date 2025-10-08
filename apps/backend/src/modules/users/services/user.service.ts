import { LogService } from '@/modules/logs/services/log.service'
import { OrgUserRepository } from '@/modules/orgs/repositories/org-user.repository'
import { OrgUserService } from '@/modules/orgs/services/org-user.service'
import bcrypt from 'bcryptjs'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'

// --- Redis helpers (tolerant) ---
let RC: any = null,
  RL: any = null,
  RClient: any = null
;(async () => {
  try {
    const mod = await import('@/common/redis/cache')
    RC = (mod as any).default ?? mod
  } catch {}
  try {
    const mod = await import('@/common/redis/lock')
    RL = (mod as any).default ?? mod
  } catch {}
  try {
    const mod = await import('@/common/redis/client')
    RClient = (mod as any).default ?? mod
  } catch {}
})()
const USER_TTL = 600
const kUserFull = (id: number) => `user:${id}:full`
const kUserMe = (id: number) => `user:${id}:me`
const kUserList = (q: any) => `user:list:${JSON.stringify(q)}`
const kUserSettings = (id: number) => `user:${id}:settings`
async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
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
  async changePassword(userId: number, current: string, next: string, req?: any) {
    const me = await this.repo.getById(userId)
    if (!me) throw new Error('用户不存在')

    // 取出哈希，用一个轻量查询（如果你 getById 不返回 password，就做一个专门查 password 的方法）
    const [rows]: any = await (this as any).repo.db.query('SELECT password FROM users WHERE id = ?', [userId])
    const hashed = rows?.[0]?.password as string | undefined
    if (!hashed) throw new Error('读取密码失败')

    const pass = bcrypt.compareSync(current, hashed)
    if (!pass) return false

    const newHashed = bcrypt.hashSync(next, 10)
    await this.repo.resetPassword(userId, newHashed)

    await LogService.log(
      {
        type: 'user',
        userId,
        username: me.username,
        action: '修改密码',
        resourceType: 'user',
        resourceId: userId,
        status: 'success',
      },
      req
    )

    // 如需强制下线其他会话，可在此清理 refresh/session（可选）
    // await TokenRepository.revokeAllByUser(userId); await SessionStore.revokeAllByUser(userId)

    await cdel(kUserFull(userId), kUserMe(userId))
    await publishToUser(userId, { type: 'password_changed' })
    return true
  }
  private readonly orgSvc = new OrgUserService()
  constructor(private readonly repo = new UserRepository()) {}

  async getById(userId: number) {
    const ck = kUserFull(userId)
    const hit = await cget(ck)
    if (hit) return hit
    const user = await this.repo.getById(userId)
    if (!user) return null
    const stats = await this.repo.statsOfUser(userId)
    const { orgId, org_name } = await this.repo.getPrimaryOrgForUser(userId)
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

  async list(params: { page: number; limit: number; role?: UserRole; search?: string }) {
    const ck = kUserList(params)
    const hit = await cget(ck)
    if (hit) return hit
    const data = await this.repo.list(params)
    await cset(ck, data, 120)
    return data
  }

  /** 按组织查询用户（转调 OrgUserService），返回 {items,total} */
  async listByOrg(params: {
    orgId: number
    page: number
    limit: number
    role?: string
    search?: string
    includeChildren?: boolean
  }) {
    return this.orgSvc.listUsers(params)
  }

  async updateMe(userId: number, patch: Partial<Pick<UserDTO, 'nickname' | 'school' | 'class_name'>>, req?: any) {
    const updated = await this.repo.updateUser(userId, patch as any)
    if (!updated) throw new Error('更新失败')

    await LogService.log(
      {
        type: 'user',
        userId,
        username: updated.username,
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

  async uploadAvatar(userId: number, avatarUrl: string, req?: any) {
    const updated = await this.repo.updateUser(userId, { avatar_url: avatarUrl })
    if (!updated) throw new Error('更新头像失败')

    await LogService.log(
      {
        type: 'user',
        userId,
        username: updated.username,
        action: '上传头像',
        resourceType: 'user',
        resourceId: Number(userId),
        details: { 头像地址: avatarUrl },
      },
      req
    )

    await cdel(kUserFull(userId), kUserMe(userId), kUserSettings(userId))
    await cdelByPattern('user:list:*')
    await publishToUser(userId, { type: 'user_updated' })
    return updated
  }

  async adminUpdate(
    targetUserId: number,
    patch: Partial<Pick<UserDTO, 'username' | 'email' | 'role' | 'avatar_url' | 'nickname' | 'school' | 'class_name'>>,
    actor?: { id?: number; username?: string },
    req?: any
  ) {
    const updated = await this.repo.updateUser(targetUserId, patch)
    if (!updated) throw new Error('用户不存在')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '管理员修改用户信息',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 修改字段: Object.keys(patch) },
      },
      req
    )

    await cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId))
    await cdelByPattern('user:list:*')
    await cdelByPattern(`perm:${targetUserId}:*`)
    await cdelByPattern(`menuTree:${targetUserId}:*`)
    await publishToUser(targetUserId, { type: 'user_updated' })
    return updated
  }

  async updateStatus(targetUserId: number, status: UserStatus, actor?: { id?: number; username?: string }, req?: any) {
    const updated = await this.repo.updateStatus(targetUserId, status)
    if (!updated) throw new Error('更新用户状态失败')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
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
    actor?: { id?: number; username?: string },
    req?: any,
    options?: { newPassword?: string; forceLogout?: boolean }
  ) {
    const defaultPassword = process.env.DEFAULT_RESET_PASSWORD || 'ChangeMe123!'
    const plain = options?.newPassword || defaultPassword

    const exec = async () => {
      const hashed = await bcrypt.hash(plain, 10)
      const ok = await this.repo.resetPassword(targetUserId, hashed)
      if (!ok) throw new Error('RESET_NOT_APPLIED')

      await LogService.log(
        {
          type: 'user',
          userId: actor?.id || 0,
          username: actor?.username,
          action: '重置用户密码',
          resourceType: 'user',
          resourceId: targetUserId,
          details: { 是否自定义: !!options?.newPassword },
        },
        req
      )

      // 可选：强制下线其它会话
      if (options?.forceLogout) {
        // 在此清理 refreshToken / sessions（如有实现）
      }

      await cdel(kUserFull(targetUserId), kUserMe(targetUserId))
      await publishToUser(targetUserId, { type: 'password_reset' })
      return plain // 仅用于“默认密码”场景回显；Controller 已根据是否自定义决定是否返回给前端
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

  async deleteUser(targetUserId: number, targetRole: UserRole, actor?: { id?: number; username?: string }, req?: any) {
    if (targetRole === 'admin') throw new Error('管理员账号不允许删除')
    const ok = await this.repo.deleteUser(targetUserId)
    if (!ok) throw new Error('删除用户失败')

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '删除用户',
        resourceType: 'user',
        resourceId: targetUserId,
        details: { 目标用户ID: targetUserId },
      },
      req
    )

    await cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId))
    await cdelByPattern('user:list:*')
    await cdelByPattern(`perm:${targetUserId}:*`)
    await cdelByPattern(`menuTree:${targetUserId}:*`)
    await publishToUser(targetUserId, { type: 'user_updated' })
  }

  async getSettings(userId: number): Promise<UserSettings> {
    const ck = kUserSettings(userId)
    const hit = await cget<UserSettings>(ck)
    if (hit) return hit
    const s = (await this.repo.getSettings(userId)) || {
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

  /** 当 /users/:id 接收到 orgId|org_id 字段时，统一在业务层编排 org 关系 */
  async setUserOrg(
    targetUserId: number,
    nextOrgId: number | null, // null=移除主组织；number=设置/迁移为该组织
    actor?: { id?: number; username?: string }
  ) {
    if (!(nextOrgId === null || Number.isFinite(nextOrgId))) return

    const prevOrgId = await OrgUserRepository.currentPrimaryOrgId(targetUserId)

    if (nextOrgId === null) {
      if (prevOrgId != null) {
        await this.orgSvc.removeUser(actor, prevOrgId, targetUserId)
      }
    } else if (prevOrgId == null) {
      await this.orgSvc.setPrimary(actor, nextOrgId, targetUserId)
    } else if (prevOrgId !== nextOrgId) {
      await this.orgSvc.moveUser(actor, prevOrgId, nextOrgId, targetUserId)
    } else {
      // 不变更
    }

    // 缓存与权限失效 + 推送
    await cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId))
    await cdelByPattern('user:list:*')
    await cdelByPattern(`perm:${targetUserId}:*`)
    await cdelByPattern(`menuTree:${targetUserId}:*`)
    await publishToUser(targetUserId, { type: 'user_updated' })
  }
}

export default UserService
