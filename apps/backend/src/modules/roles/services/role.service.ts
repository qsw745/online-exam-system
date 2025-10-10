// apps/backend/src/modules/roles/services/role.service.ts
import type { CreateRoleRequest, Role, UpdateRoleRequest } from '../domain/role.model.js'
import { RoleRepository } from '../repositories/role.repository.js'
import type { RowDataPacket } from 'mysql2/promise'

import { pool } from '@/config/database.js'
import { getOrgUserTable, getOrgTable, OrgUserRepository } from '@/modules/orgs/repositories/org-user.repository.js'

// 最小化的可查询接口，避免与全局 Pool 冲突
type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}
const db: Queryable = pool as unknown as Queryable

let RC: any = null,
  RL: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default || (await import('@/common/redis/cache'))
  } catch {}
  try {
    RL = (await import('@/common/redis/lock')).default || (await import('@/common/redis/lock'))
  } catch {}
})()

const ROLE_TTL = 600
const kRole = (id: number) => `role:${id}`
const kRolePg = (q: any) => `role:list:${JSON.stringify(q)}`

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = ROLE_TTL) {
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

function invalidateAuthCache() {
  cdelByPattern('menuTree:*')
  cdelByPattern('perm:*')
  cdelByPattern('menuTree:scope:*')
}

function toTinyint(v: any): 0 | 1 {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0
}
function toIntOr(v: any, d: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
export function slugifyCode(input: string): string {
  return (
    (input || '')
      .toLowerCase()
      .trim()
      .replace(/[\s\u4e00-\u9fa5]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'role'
  )
}
export class DuplicateCodeError extends Error {
  status = 409 as const
  constructor(msg = '角色编码已存在') {
    super(msg)
  }
}

export class RoleService {
  // -------- 列表 --------
  static async getAllRoles() {
    const ck = 'role:list:all'
    const hit = await cget<Role[]>(ck)
    if (hit) return hit
    const rows = await RoleRepository.findAll()
    await cset(ck, rows, 600)
    return rows
  }

  static async getRolesWithPagination(
    page: number,
    pageSize: number,
    keyword?: string,
    orgId?: number | null
  ): Promise<{ roles: Role[]; total: number }> {
    const offset = (page - 1) * pageSize
    const params: any[] = []
    const where: string[] = []

    if (typeof orgId !== 'undefined') {
      where.push('org_id <=> ?')
      params.push(orgId ?? null)
    }
    if (keyword && keyword.trim()) {
      where.push('(name LIKE ? OR description LIKE ? OR code LIKE ?)')
      const s = `%${keyword.trim()}%`
      params.push(s, s, s)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const { rows, total } = await RoleRepository.findPage(whereSql, params, pageSize, offset)
    return { roles: rows, total }
  }

  // -------- CRD --------
  static async getRoleById(id: number) {
    const ck = kRole(id)
    const hit = await cget<Role>(ck)
    if (hit) return hit
    const r = await RoleRepository.findById(id)
    if (r) await cset(ck, r, 600)
    return r
  }

  static async codeExists(code: string, orgId: number | null, excludeId?: number): Promise<boolean> {
    return RoleRepository.codeExists(slugifyCode(code), orgId, excludeId)
  }
  static async nameExists(name: string, orgId: number | null, excludeId?: number): Promise<boolean> {
    return RoleRepository.nameExists(name.trim(), orgId, excludeId)
  }

  static async suggestUniqueCode(nameOrCode: string, orgId: number | null = null): Promise<string> {
    const base = slugifyCode(nameOrCode)
    if (!(await RoleRepository.codeExists(base, orgId))) return base
    let i = 1
    while (await RoleRepository.codeExists(`${base}_${i}`, orgId)) i++
    return `${base}_${i}`
  }

  /** 全局（org_id=null）创建 */
  static async createRole(dto: CreateRoleRequest): Promise<Role> {
    return this.createRoleUnderOrg(null, dto)
  }

  /** 按机构创建 */
  static async createRoleUnderOrg(orgId: number | null, dto: CreateRoleRequest): Promise<Role> {
    const name = String(dto?.name ?? '').trim()
    if (!name) throw new Error('角色名称不能为空')

    if (await this.nameExists(name, orgId)) throw new Error('该机构下角色名称已存在，请使用其他名称')

    let code = String(dto?.code ?? '').trim()
    if (!code) code = await this.suggestUniqueCode(name, orgId)
    code = slugifyCode(code)
    if (await this.codeExists(code, orgId)) throw new DuplicateCodeError('该机构下角色编码已存在，请使用其他编码')

    let sort = dto?.sort_order
    if (sort == null) {
      const all = await RoleRepository.findAll('ORDER BY sort_order DESC LIMIT 1')
      sort = (all[0]?.sort_order ?? 0) + 1
    }

    const id = await RoleRepository.insert({
      org_id: orgId ?? null,
      name,
      code,
      description: dto?.description ?? null,
      sort_order: toIntOr(sort, 1),
      is_disabled: toTinyint(dto?.is_disabled),
    })
    const role = await RoleRepository.findById(id)
    if (!role) throw new Error('创建角色失败')
    return role
  }

  static async updateRole(id: number, dto: UpdateRoleRequest): Promise<Role | null> {
    const role = await RoleRepository.findById(id)
    if (!role) return null
    if (role.is_system && dto.name !== undefined) throw new Error('系统角色不允许修改名称')

    const orgId = dto.org_id !== undefined ? dto.org_id : role.org_id
    const partial: Partial<Role> = {}

    if (dto.name !== undefined && !role.is_system) {
      const newName = String(dto.name).trim()
      if (!newName) throw new Error('角色名称不能为空')
      if (await this.nameExists(newName, orgId, id)) throw new Error('该机构下角色名称已存在，请使用其他名称')
      partial.name = newName
    }
    if (dto.code !== undefined && !role.is_system) {
      const newCode = slugifyCode(String(dto.code).trim())
      if (!newCode) throw new Error('角色编码不能为空')
      if (await this.codeExists(newCode, orgId, id))
        throw new DuplicateCodeError('该机构下角色编码已存在，请使用其他编码')
      partial.code = newCode
    }
    if (dto.description !== undefined) partial.description = dto.description ?? null
    if (dto.is_disabled !== undefined) partial.is_disabled = toTinyint(dto.is_disabled)
    if (dto.sort_order !== undefined) partial.sort_order = toIntOr(dto.sort_order, role.sort_order ?? 1)
    if (dto.org_id !== undefined) partial.org_id = dto.org_id

    await RoleRepository.update(id, partial)
    return RoleRepository.findById(id)
  }

  static async deleteRole(id: number): Promise<boolean> {
    const role = await RoleRepository.findById(id)
    if (!role) return false
    if (role.is_system) throw new Error('系统角色不允许删除')
    if (await RoleRepository.isRoleUsedByUsers(id)) throw new Error('该角色正在被用户使用，无法删除')
    return RoleRepository.remove(id)
  }

  // ===== 菜单权限 / 用户角色 =====
  static async getRoleMenus(roleId: number) {
    return RoleRepository.listRoleMenus(roleId)
  }
  static async setRoleMenus(roleId: number, menuIds: number[]) {
    invalidateAuthCache()
    return RoleRepository.setRoleMenus(roleId, menuIds)
  }
  static async getUserRoles(userId: number) {
    return RoleRepository.listUserRoles(userId)
  }
  static async setUserRoles(userId: number, roleIds: number[]) {
    invalidateAuthCache()
    return RoleRepository.setUserRoles(userId, roleIds)
  }
  static async getRoleUsers(roleId: number) {
    return RoleRepository.listRoleUsers(roleId)
  }

  static async getNextSortOrder(): Promise<number> {
    const all = await RoleRepository.findAll('ORDER BY sort_order DESC LIMIT 1')
    return (all[0]?.sort_order ?? 0) + 1
  }

  // ===== 角色 ⇄ 用户（增/删） =====
  static async addUsersToRole(roleId: number, userIds: number[]) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')

    const ids = Array.from(new Set(userIds.map(Number).filter(n => Number.isFinite(n))))
    if (!ids.length) return 0
    invalidateAuthCache()
    return RoleRepository.addUsersToRole(roleId, ids)
  }

  static async removeUserFromRole(roleId: number, userId: number) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')
    const uid = Number(userId)
    if (!Number.isFinite(uid)) throw new Error('无效的用户ID')
    invalidateAuthCache()
    await RoleRepository.removeUserFromRole(roleId, uid)
  }

  // ----- 角色 ⇄ 机构 -----
  static async getRoleOrgs(roleId: number) {
    return RoleRepository.roleOrgs(roleId)
  }

  static async addOrgsToRole(roleId: number, orgIds: number[]) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')
    const ids = Array.from(new Set(orgIds.map(Number).filter(Number.isFinite)))
    if (!ids.length) return 0
    const added = await RoleRepository.addRoleOrgs(roleId, ids)
    invalidateAuthCache()
    return added
  }

  static async removeOrgFromRole(roleId: number, orgId: number) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')
    await RoleRepository.removeRoleOrg(roleId, orgId)
    invalidateAuthCache()
  }

  // ✅ 从机构（可含子机构）批量拿用户加入角色
  static async addUsersFromOrg(roleId: number, orgId: number, includeChildren = false) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')

    const orgUserTable = await getOrgUserTable()
    const orgIdField = await OrgUserRepository.orgIdField()
    const orgTable = await getOrgTable()

    let ids = [orgId]
    if (includeChildren) {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          `
          WITH RECURSIVE c AS (
            SELECT id FROM ${orgTable} WHERE id=?
            UNION ALL
            SELECT o.id FROM ${orgTable} o JOIN c ON o.parent_id = c.id
          ) SELECT id FROM c
          `,
          [orgId]
        )
        ids = (rows as any[]).map((r: any) => Number(r.id)).filter(Boolean)
      } catch {
        /* MySQL < 8 忽略子机构 */
      }
    }

    const [urows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT user_id FROM ${orgUserTable} WHERE ${orgIdField} IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    const userIds = (urows as any[]).map((r: any) => Number(r.user_id)).filter(Boolean)
    if (!userIds.length) return 0

    invalidateAuthCache()
    return RoleRepository.addUsersToRole(roleId, userIds)
  }
}
