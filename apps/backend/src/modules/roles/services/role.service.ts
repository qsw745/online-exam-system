import type { CreateRoleRequest, Role, UpdateRoleRequest } from '../domain/role.model.js'
import { RoleRepository } from '../repositories/role.repository.js'
import { MenuService } from '@/modules/menus/services/menus.service.js'
import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

// 轻量 Query 接口（避免类型参数报错）
type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const db: Queryable = pool as unknown as Queryable

let RC: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default || (await import('@/common/redis/cache'))
  } catch {}
})()

const ROLE_TTL = 600
const kRole = (id: number) => `role:${id}`
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
    const { rows, total } = await RoleRepository.findPageWithOrg(orgId ?? undefined, keyword, pageSize, offset)
    // ✅ 修正类型：返回 { roles, total }
    return { roles: rows, total }
  }

  // -------- 读 --------
  static async getRoleById(id: number) {
    const ck = kRole(id)
    const hit = await cget<Role>(ck)
    if (hit) return hit
    const r = await RoleRepository.findById(id)
    if (r) await cset(ck, r, 600)
    return r
  }

  // -------- 创建 --------
  static async createRole(dto: CreateRoleRequest): Promise<Role> {
    const name = String(dto?.name ?? '').trim()
    if (!name) throw new Error('角色名称不能为空')

    let code = String(dto?.code ?? '').trim()
    if (!code) code = slugifyCode(name)
    code = slugifyCode(code)

    let sort = dto?.sort_order
    if (sort == null) {
      const all = await RoleRepository.findAll('ORDER BY sort_order DESC LIMIT 1')
      sort = (all[0]?.sort_order ?? 0) + 1
    }

    const id = await RoleRepository.insert({
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

  /** 在机构下创建（可选，多对多通过 role_orgs） */
  static async createRoleUnderOrg(orgId: number, dto: CreateRoleRequest): Promise<Role> {
    const role = await this.createRole(dto)
    await RoleRepository.addRoleOrgs(role.id, [orgId])
    return role
  }

  // -------- 更新/删除 --------
  static async updateRole(id: number, dto: UpdateRoleRequest): Promise<Role | null> {
    const role = await RoleRepository.findById(id)
    if (!role) return null
    if (role.is_system && dto.name !== undefined) throw new Error('系统角色不允许修改名称')

    const partial: Partial<Role> = {}
    if (dto.name !== undefined && !role.is_system) {
      const newName = String(dto.name).trim()
      if (!newName) throw new Error('角色名称不能为空')
      partial.name = newName
    }
    if (dto.code !== undefined && !role.is_system) {
      const newCode = slugifyCode(String(dto.code).trim())
      if (!newCode) throw new Error('角色编码不能为空')
      partial.code = newCode
    }
    if (dto.description !== undefined) partial.description = dto.description ?? null
    if (dto.is_disabled !== undefined) partial.is_disabled = toTinyint(dto.is_disabled)
    if (dto.sort_order !== undefined) partial.sort_order = toIntOr(dto.sort_order, role.sort_order ?? 1)

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

  // ===== 权限/菜单 =====
  static async getRoleMenus(roleId: number) {
    const codes = await RoleRepository.listPermissionCodes(roleId)
    return RoleRepository.menusByPermissionCodes(codes)
  }
  static async setRoleMenus(roleId: number, menuIds: number[]) {
    const codes = await RoleRepository.permissionCodesFromMenuIds(menuIds)
    await RoleRepository.setPermissionCodes(roleId, codes)
    await MenuService.assignRoleMenus(roleId, menuIds)
    invalidateAuthCache()
  }

  // ===== 用户 ⇄ 角色 =====
  static async getUserRoles(userId: number) {
    const [rows] = (await (pool as any).execute(
      `SELECT r.* FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?
       ORDER BY r.is_system DESC, r.created_at ASC`,
      [userId]
    )) as [RowDataPacket[], any]
    return rows as unknown as Role[]
  }

  static async getRolesForAssign(userId: number, orgId?: number | null) {
    const orgRoles = typeof orgId === 'number' && Number.isFinite(orgId) ? await RoleRepository.listRolesByOrg(orgId) : []
    const globalRoles = await RoleRepository.findAll()
    const current = await this.getUserRoles(userId)

    const merged = new Map<number, Role>()
    for (const r of globalRoles) merged.set(r.id, r)
    for (const r of orgRoles) merged.set(r.id, r)
    for (const r of current) merged.set(r.id, r)

    const roles = Array.from(merged.values()).sort((a, b) => {
      const sysDiff = Number(b.is_system ? 1 : 0) - Number(a.is_system ? 1 : 0)
      if (sysDiff !== 0) return sysDiff
      const sortA = Number(a.sort_order ?? 0)
      const sortB = Number(b.sort_order ?? 0)
      if (sortA !== sortB) return sortA - sortB
      return Number(a.id) - Number(b.id)
    })
    const selected = current.map(r => Number(r.id)).filter(Number.isFinite)
    return { roles, selected }
  }

  static async setUserRoles(userId: number, roleIds: number[]) {
    try {
      await MenuService.assignUserRoles(userId, roleIds)
    } catch (err: any) {
      if (err?.message && /没有主组织|primary org/i.test(err.message)) {
        await RoleRepository.replaceUserRoles(userId, roleIds)
      } else {
        throw err
      }
    }
    invalidateAuthCache()
  }

  static async getRoleUsers(roleId: number) {
    const [rows] = (await (pool as any).execute(
      `SELECT u.id, u.username, u.email, ur.created_at AS assigned_at
         FROM users u JOIN user_roles ur ON ur.user_id = u.id
        WHERE ur.role_id = ?
        ORDER BY ur.created_at DESC`,
      [roleId]
    )) as [RowDataPacket[], any]
    return rows
  }

  /** ✅ 给控制器调用的两个方法（避免再去直接 import Repository） */
  static async addUsersToRole(roleId: number, userIds: number[]) {
    invalidateAuthCache()
    return RoleRepository.addUsersToRole(roleId, Array.from(new Set(userIds.map(Number).filter(Number.isFinite))))
  }
  static async removeUserFromRole(roleId: number, userId: number) {
    invalidateAuthCache()
    return RoleRepository.removeUserFromRole(roleId, Number(userId))
  }

  static async getNextSortOrder(): Promise<number> {
    const all = await RoleRepository.findAll('ORDER BY sort_order DESC LIMIT 1')
    return (all[0]?.sort_order ?? 0) + 1
  }

  // ===== 角色 ⇄ 机构（可选）=====
  static async getRoleOrgs(roleId: number) {
    return RoleRepository.roleOrgs(roleId)
  }
  static async addOrgsToRole(roleId: number, orgIds: number[]) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')
    const added = await RoleRepository.addRoleOrgs(
      roleId,
      Array.from(new Set(orgIds.map(Number).filter(Number.isFinite)))
    )
    invalidateAuthCache()
    return added
  }
  static async removeOrgFromRole(roleId: number, orgId: number) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')
    await RoleRepository.removeRoleOrg(roleId, orgId)
    invalidateAuthCache()
  }

  // ✅ 按机构（可含子机构）批量把用户加入某角色（保留）
  static async addUsersFromOrg(roleId: number, orgId: number, includeChildren = false) {
    const role = await RoleRepository.findById(roleId)
    if (!role) throw new Error('角色不存在')

    const orgTable = 'organizations'
    const orgUserTable = 'org_users' // 如果你库里的名字不同，这里替换
    const orgIdField = 'org_id'

    let ids = [orgId]
    if (includeChildren) {
      try {
        const [rows] = await db.query<RowDataPacket[]>(
          `WITH RECURSIVE c AS (
            SELECT id FROM ${orgTable} WHERE id=?
            UNION ALL
            SELECT o.id FROM ${orgTable} o JOIN c ON o.parent_id = c.id
          ) SELECT id FROM c`,
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

    const sql = `INSERT IGNORE INTO user_roles (user_id, role_id, created_at)
                 VALUES ${userIds.map(() => '(?, ?, NOW())').join(', ')}`
    const params = userIds.flatMap(uid => [uid, roleId])
    const [ret] = (await (pool as any).execute(sql, params)) as [ResultSetHeader, any]
    invalidateAuthCache()
    return ret.affectedRows
  }

  /** ✅ 新增：一次返回全部菜单 + 该角色选中ID */
  static async getMenusAndSelected(roleId: number): Promise<{ menus: any[]; selected: number[] }> {
    // 1) 取该角色拥有的权限码
    const codes = await RoleRepository.listPermissionCodes(roleId)

    // 2) 把权限码映射回“被选中的菜单ID”（仅包含有 permission_code 的菜单）
    const selected = await RoleRepository.menuIdsFromPermissionCodes(codes)

    // 3) 全量菜单（未禁用）
    const menus = await RoleRepository.findAllMenus()

    // （可选：也可以把 checkedMap 返回给前端）
    return { menus, selected }
  }
}
