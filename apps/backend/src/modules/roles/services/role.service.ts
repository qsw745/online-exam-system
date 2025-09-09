// apps/backend/src/modules/roles/services/role.service.ts
import type { CreateRoleRequest, Role, UpdateRoleRequest } from '../domain/role.model.js'
import { RoleRepository } from '../repositories/role.repository.js'

/** 工具：把布尔/数字/字符串转 tinyint(1) 0/1 */
function toTinyint(v: any): 0 | 1 {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0
}
/** 工具：安全的数字（给 sort_order 用） */
function toIntOr(v: any, d: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
/** 规范化 code */
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
  static async getAllRoles(): Promise<Role[]> {
    return RoleRepository.findAll()
  }
  static async getRolesWithPagination(
    page: number,
    pageSize: number,
    keyword?: string
  ): Promise<{ roles: Role[]; total: number }> {
    const offset = (page - 1) * pageSize
    let where = ''
    const params: any[] = []
    if (keyword && keyword.trim()) {
      where = 'WHERE name LIKE ? OR description LIKE ? OR code LIKE ?'
      const s = `%${keyword.trim()}%`
      params.push(s, s, s)
    }
    const { rows, total } = await RoleRepository.findPage(where, params, pageSize, offset)
    return { roles: rows, total }
  }
  static async getRoleById(id: number): Promise<Role | null> {
    return RoleRepository.findById(id)
  }
  static async codeExists(code: string): Promise<boolean> {
    return RoleRepository.codeExists(slugifyCode(code))
  }
  static async suggestUniqueCode(nameOrCode: string): Promise<string> {
    const base = slugifyCode(nameOrCode)
    if (!(await RoleRepository.codeExists(base))) return base
    let i = 1
    while (await RoleRepository.codeExists(`${base}_${i}`)) i++
    return `${base}_${i}`
  }
  static async createRole(dto: CreateRoleRequest): Promise<Role> {
    const name = String(dto?.name ?? '').trim()
    if (!name) throw new Error('角色名称不能为空')

    // 可选：同名校验（如需允许重名可移除）
    const byName = await RoleRepository.findByName(name)
    if (byName) throw new Error('角色名称已存在，请使用其他名称')

    let code = String(dto?.code ?? '').trim()
    if (!code) code = await this.suggestUniqueCode(name)
    code = slugifyCode(code)
    if (await RoleRepository.codeExists(code)) throw new DuplicateCodeError('角色编码已存在，请使用其他编码')

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
  static async updateRole(id: number, dto: UpdateRoleRequest): Promise<Role | null> {
    const role = await RoleRepository.findById(id)
    if (!role) return null
    if (role.is_system && dto.name !== undefined) throw new Error('系统角色不允许修改名称')

    const partial: Partial<Role> = {}
    if (dto.name !== undefined && !role.is_system) partial.name = String(dto.name).trim()
    if (dto.code !== undefined && !role.is_system) {
      const newCode = slugifyCode(String(dto.code).trim())
      if (!newCode) throw new Error('角色编码不能为空')
      if (await RoleRepository.codeExists(newCode, id)) throw new DuplicateCodeError('角色编码已存在，请使用其他编码')
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

  // ===== 菜单权限 / 用户角色 =====
  static async getRoleMenus(roleId: number) {
    return RoleRepository.listRoleMenus(roleId)
  }
  static async setRoleMenus(roleId: number, menuIds: number[]) {
    return RoleRepository.setRoleMenus(roleId, menuIds)
  }
  static async getUserRoles(userId: number) {
    return RoleRepository.listUserRoles(userId)
  }
  static async setUserRoles(userId: number, roleIds: number[]) {
    return RoleRepository.setUserRoles(userId, roleIds)
  }
  static async getRoleUsers(roleId: number) {
    return RoleRepository.listRoleUsers(roleId)
  }

  static async getNextSortOrder(): Promise<number> {
    const all = await RoleRepository.findAll('ORDER BY sort_order DESC LIMIT 1')
    return (all[0]?.sort_order ?? 0) + 1
  }

  // ===== 角色 ⇄ 机构 =====
  static async getRoleOrgs(roleId: number) {
    return RoleRepository.roleOrgs(roleId)
  }
  static async addOrgsToRole(roleId: number, orgIds: number[]) {
    return RoleRepository.addRoleOrgs(roleId, orgIds)
  }
  static async removeOrgFromRole(roleId: number, orgId: number) {
    return RoleRepository.removeRoleOrg(roleId, orgId)
  }

  // ===== 用户从角色移除 / 批量添加 =====
  static async removeUserFromRole(roleId: number, userId: number) {
    // 直接删（若原无关系，受影响行数为 0；兼容业务层的“该用户不在此角色中”提示可在 controller 中根据需要调整）
    await RoleRepository.setUserRoles(userId, [
      ...(await this.getUserRoles(userId)).filter(r => r.id !== roleId).map(r => r.id),
    ])
  }

  static async addUsersToRole(roleId: number, userIds: number[]) {
    const current = new Map<number, number[]>()
    for (const uid of userIds) {
      const roles = await this.getUserRoles(uid)
      current.set(
        uid,
        roles.map(r => r.id)
      )
    }
    for (const uid of userIds) {
      const merged = Array.from(new Set([...(current.get(uid) || []), roleId]))
      await RoleRepository.setUserRoles(uid, merged)
    }
  }
}
