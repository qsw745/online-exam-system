/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogService } from '@/modules/logs/services/log.service'
import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2/promise'
import type { UserDTO, UserRole, UserSettings, UserStatus } from '../domain/user.model'
import { UserRepository } from '../repositories/user.repository.js'
import { OrgRepository } from '@/modules/orgs/repositories/org.repository.js'

// --- 当项目未安装 @types/node 时，给 process 提供极小的类型声明以通过编译 ---
declare const process: { env?: Record<string, string | undefined> } | undefined

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
  /** 用户数据仓库 */
  private readonly repo: UserRepository

  constructor(repo: UserRepository = new UserRepository()) {
    this.repo = repo
  }

  // =============== 辅助：查询主组织及名称（不依赖 org-user） ===============
  private async getPrimaryOrgMeta(userId: number): Promise<{ orgId: number | null; org_name: string | null }> {
    try {
      const db = (this as any).repo.db
      const ret: any = await db.query(
        `SELECT uo.org_id, o.name AS org_name
           FROM user_organizations uo
           LEFT JOIN organizations o ON o.id = uo.org_id
          WHERE uo.user_id = ? AND uo.is_primary = 1
          LIMIT 1`,
        [userId]
      )
      const rows: RowDataPacket[] = (ret && ret[0]) || []
      const orgId = rows?.[0]?.org_id ?? null
      const org_name = rows?.[0]?.org_name ?? null
      return { orgId, org_name }
    } catch {
      return { orgId: null, org_name: null }
    }
  }

  // =============== 创建 ===============
  async adminCreate(
    payload: {
      username: string
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
    actor?: { id?: number; username?: string },
    req?: any
  ): Promise<UserDTO> {
    const hashed = await bcrypt.hash(payload.password, 10)
    const created = await this.repo.createUser({
      username: payload.username,
      email: payload.email ?? null,
      nickname: payload.nickname ?? null,
      passwordHash: hashed,
      role: payload.role ?? 'student',
      status: payload.status,
      phone: payload.phone ?? null,
      gender: (payload.gender as any) ?? '保密',
      remark: payload.remark ?? null,
    })

    await LogService.log(
      {
        type: 'user',
        userId: actor?.id || 0,
        username: actor?.username,
        action: '创建用户',
        resourceType: 'user',
        resourceId: created.id,
        details: { username: created.username, role: created.role, status: created.status },
      },
      req
    )

    const nextOrgId = (payload.org_id ?? null) as number | null
    if (nextOrgId !== null && Number.isFinite(nextOrgId)) {
      await this.setUserOrg(created.id, nextOrgId, actor)
    }
    return created
  }

  // =============== 改密 ===============
  async changePassword(userId: number, current: string, next: string, req?: any) {
    const me = await this.repo.getById(userId)
    if (!me) throw new Error('用户不存在')

    const ret: any = await (this as any).repo.db.execute('SELECT password FROM users WHERE id = ?', [userId])
    const rows = (ret && ret[0]) || []
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

    await cdel(kUserFull(userId), kUserMe(userId))
    await publishToUser(userId, { type: 'password_changed' })
    return true
  }

  // =============== 查询 ===============
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

  async list(params: { page: number; limit: number; role?: UserRole; search?: string }) {
    const ck = kUserList(params)
    const hit = await cget(ck)
    if (hit) return hit
    const data = await this.repo.list(params)
    await cset(ck, data, 120)
    return data
  }

  /** =============== 按组织查询用户（不依赖 org-user） =============== */
  async listByOrg(params: {
    orgId: number
    page: number
    limit: number
    role?: string
    search?: string
    includeChildren?: boolean
  }): Promise<{ items: UserDTO[]; total: number }> {
    const { orgId, page, limit, role, search, includeChildren } = params
    const db = (this as any).repo.db

    let orgIds: number[] = [orgId]
    if (includeChildren) {
      const all = await OrgRepository.findAll(true)
      const childrenMap = new Map<number, number[]>()
      for (const o of all) {
        const pid = (o.parent_id ?? null) as number | null
        if (pid != null) {
          if (!childrenMap.has(pid)) childrenMap.set(pid, [])
          childrenMap.get(pid)!.push(o.id)
        }
      }
      const stack = [orgId]
      const seen = new Set<number>([orgId])
      while (stack.length) {
        const cur = stack.pop()!
        const kids = childrenMap.get(cur) || []
        for (const k of kids) if (!seen.has(k)) seen.add(k), stack.push(k)
      }
      orgIds = Array.from(seen)
    }

    const clauses: string[] = ['uo.org_id IN (?)']
    const vals: any[] = [orgIds]
    if (role) {
      clauses.push('u.role = ?')
      vals.push(role)
    }
    if (search) {
      clauses.push('(u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
      vals.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    const where = `WHERE ${clauses.join(' AND ')}`
    const offset = (page - 1) * limit

    const rowsRes: any = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.nickname, u.school, u.class_name, u.experience_points, u.level,
              u.avatar_url, u.status, u.phone, u.gender, u.remark, u.created_at, u.updated_at
         FROM users u
         INNER JOIN user_organizations uo ON uo.user_id = u.id
        ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    )
    const items: UserDTO[] = (rowsRes && rowsRes[0]) || []

    const cntRes: any = await db.query(
      `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN user_organizations uo ON uo.user_id = u.id
        ${where}`,
      vals
    )
    const total = Number(((cntRes && cntRes[0] && cntRes[0][0]) || ({} as any)).total || 0)

    return { items, total }
  }

  // =============== 自我更新 / 头像 ===============
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

  // =============== 管理员更新/状态 ===============
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

    await Promise.all([
      cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId)),
      cdelByPattern('user:list:*'),
      cdelByPattern(`perm:${targetUserId}:*`),
      cdelByPattern(`menuTree:${targetUserId}:*`),
      publishToUser(targetUserId, { type: 'user_updated' }),
    ])

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

  // =============== 重置密码 ===============
  async resetPassword(
    targetUserId: number,
    actor?: { id?: number; username?: string },
    req?: any,
    options?: { newPassword?: string; forceLogout?: boolean }
  ) {
    const defaultPassword =
      (typeof process !== 'undefined' ? process?.env?.DEFAULT_RESET_PASSWORD : undefined) || 'ChangeMe123!'
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

      if (options?.forceLogout) {
        // 清理会话（如实现）
      }

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

  // =============== 删除用户（供 Controller 调用） ===============
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

  // =============== 组织编排（直接 SQL，不依赖 org-user） ===============
  async setUserOrg(targetUserId: number, nextOrgId: number | null, _actor?: { id?: number; username?: string }) {
    if (!(nextOrgId === null || Number.isFinite(nextOrgId))) return

    const db = (this as any).repo.db

    // 读取当前主组织
    const prevRes: any = await db.query(
      'SELECT org_id FROM user_organizations WHERE user_id=? AND is_primary=1 LIMIT 1',
      [targetUserId]
    )
    const prevOrgId: number | null = ((prevRes && prevRes[0] && prevRes[0][0]) || ({} as any)).org_id ?? null

    if (nextOrgId === null) {
      if (prevOrgId != null) {
        await db.query('DELETE FROM user_organizations WHERE user_id=? AND org_id=?', [targetUserId, prevOrgId])
      }
    } else if (prevOrgId == null) {
      // 先清空主标记，再设置主组织（插入或更新）
      await db.query('UPDATE user_organizations SET is_primary=0 WHERE user_id=?', [targetUserId])
      await db.query(
        `INSERT INTO user_organizations (user_id, org_id, is_primary, assigned_at, created_at)
         VALUES (?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE is_primary=1, assigned_at=VALUES(assigned_at)`,
        [targetUserId, nextOrgId]
      )
    } else if (prevOrgId !== nextOrgId) {
      await db.query('UPDATE user_organizations SET is_primary=0 WHERE user_id=?', [targetUserId])
      await db.query(
        `INSERT INTO user_organizations (user_id, org_id, is_primary, assigned_at, created_at)
         VALUES (?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE is_primary=1, assigned_at=VALUES(assigned_at)`,
        [targetUserId, nextOrgId]
      )
    }

    await cdel(kUserFull(targetUserId), kUserMe(targetUserId), kUserSettings(targetUserId))
    await cdelByPattern('user:list:*')
    await cdelByPattern(`perm:${targetUserId}:*`)
    await cdelByPattern(`menuTree:${targetUserId}:*`)
    await publishToUser(targetUserId, { type: 'user_updated' })
  }

  // =============== 设置 ===============
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
}

export default UserService
