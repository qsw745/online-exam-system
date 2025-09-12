// apps/backend/src/modules/menus/services/menus.service.ts
import type {
  CreateMenuRequest,
  CreateRoleRequest,
  Menu,
  MenuTreeNode,
  Role,
  UpdateMenuRequest,
  UpdateRoleRequest,
  UserMenuPermission,
} from '../domain/menu.model.js'
import { UnitRepo } from '../repositories/unit-menu.repository.js'

import { MenuRepository, type MenuUpdate } from '../repositories/menu.repository.js'
import httpError from "@/common/errors/http-error";
type ScopeArgs = { scope?: '' | 'system' | 'unit'; unitId?: number }

// 规范化 meta：对象->JSON；空/非法->null；字符串若是 JSON -> 规范化，否则 null
function normalizeMeta(value: any): any | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return null
    try {
      return JSON.stringify(JSON.parse(t))
    } catch {
      return null
    }
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }
  return null
}

export class MenuService {

  // ---- Menus
  static async getAllMenus(args: ScopeArgs = {}): Promise<Menu[]> {
    const { scope, unitId } = args
    if (scope === 'system') return MenuRepository.findMenusByFilter({ is_system: 1 })

    if (scope === 'unit') {
      if (!unitId) throw new Error('unitId required')
      // 关键：只看单位“覆盖项”，没有就返回空
      return UnitRepo.findOverridesAsMenus(unitId)
    }

    return MenuRepository.findAllMenus()
  }


  private static buildMenuTree(menus: Menu[], parentId: number | null = null): MenuTreeNode[] {
    const nodes: MenuTreeNode[] = []
    for (const m of menus) {
      if (m.parent_id === parentId) {
        const node: MenuTreeNode = { ...m, children: this.buildMenuTree(menus, m.id) }
        nodes.push(node)
      }
    }
    return nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  static async getMenuTree(args: ScopeArgs = {}): Promise<MenuTreeNode[]> {
    const menus = await this.getAllMenus(args)
    return this.buildMenuTree(menus)
  }

  static async getMenuById(id: number): Promise<Menu | null> {
    return MenuRepository.findMenuById(id)
  }

  /** 单位菜单的“新增/编辑/删除”，不改系统表，只写覆盖 */
  static async createMenu(data: CreateMenuRequest & { unitId?: number; sys_menu_id?: number }): Promise<number> {
    // 单位页的“新增”本质是：对某个系统菜单做覆盖；因此必须带 sys_menu_id
    if (!data.unitId || !data.sys_menu_id) throw new Error('unitId/sys_menu_id required')
    await UnitRepo.upsertUnitOverride(data.unitId, data.sys_menu_id, data as any)
    return data.sys_menu_id!  // 仍使用系统ID作为逻辑主键
  }


  static async updateMenu(data: UpdateMenuRequest & { unitId?: number; sys_menu_id?: number }): Promise<boolean> {
    if (!data.unitId || !data.sys_menu_id) throw new Error('unitId/sys_menu_id required')
    await UnitRepo.upsertUnitOverride(data.unitId, data.sys_menu_id, data as any)
    return true
  }


  static async deleteMenu(id: number, unitId?: number, asUnit = false): Promise<boolean> {
    if (asUnit) {
      if (!unitId) throw new Error('unitId required')
      await UnitRepo.deleteUnitOverride(unitId, id) // 这里的 id 就是 sys_menu_id
      return true
    }
    // 系统菜单删除（功能菜单页才用）
    const cur = await MenuRepository.findMenuById(id)
    if (!cur || cur.is_system === false) return false
    const childCount = await MenuRepository.countChildren(id)
    if (childCount > 0) throw new Error('无法删除包含子菜单的系统菜单')
    return MenuRepository.deleteMenu(id)
  }

  static async batchUpdateMenuSort(updates: MenuUpdate[], args?: { scope?: 'system'|'unit'; unitId?: number }) {
    if (!updates?.length) return true
    if (args?.scope === 'unit') {
      if (!args.unitId) throw new Error('unitId required')
      // 将 {id,parent_id,sort_order} 转成覆盖的 {sys_menu_id,parent_sys_id,sort_order}
      const mapped = updates.map(u => ({
        sys_menu_id: u.id,
        sort_order: u.sort_order,
        parent_sys_id: u.parent_id ?? null,
      }))
      await UnitRepo.batchUpsertSort(args.unitId, mapped)
      return true
    }
    // 系统树排序（谨慎）
    await MenuRepository.batchUpdateSort(updates)
    return true
  }
  // ---- Roles
  static async getAllRoles(): Promise<Role[]> {
    return MenuRepository.findAllRoles()
  }

  static async getRoleById(id: number): Promise<Role | null> {
    return MenuRepository.findRoleById(id)
  }

  static async createRole(data: CreateRoleRequest): Promise<number> {
    if (!data.code) throw new Error('角色编码(code)必填且唯一')
    const sort = data.sort_order ?? (await MenuRepository.maxRoleSort()) + 1
    return MenuRepository.insertRole({ ...data, sort_order: sort, is_system: !!data.is_system, is_disabled: false })
  }

  static async updateRole(data: UpdateRoleRequest): Promise<boolean> {
    return MenuRepository.updateRole(data)
  }

  static async deleteRole(id: number): Promise<boolean> {
    const role = await MenuRepository.findRoleById(id)
    if (!role) return false
    if (role.is_system) throw new Error('系统角色不允许删除')
    if (await MenuRepository.anyUserUsingRole(id)) throw new Error('该角色正在被用户使用，无法删除')
    return MenuRepository.deleteRole(id)
  }

  static async assignRoleMenus(roleId: number, menuIds: number[]): Promise<boolean> {
    await MenuRepository.replaceRoleMenus(roleId, menuIds)
    return true
  }

  static async getRoleMenus(roleId: number): Promise<number[]> {
    return MenuRepository.getRoleMenuIds(roleId)
  }

  // ---- User & Org
  static async assignUserRolesInOrg(userId: number, orgId: number, roleIds: number[]): Promise<boolean> {
    await MenuRepository.replaceUserRolesInOrg(userId, orgId, roleIds)
    return true
  }

  static async getUserRolesInOrg(userId: number, orgId: number): Promise<Role[]> {
    return MenuRepository.findUserRolesInOrg(userId, orgId)
  }

  static async assignUserRoles(userId: number, roleIds: number[]): Promise<boolean> {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) throw new Error('用户没有主组织，无法分配角色')
    return this.assignUserRolesInOrg(userId, orgId, roleIds)
  }

  static async getUserRoles(userId: number): Promise<Role[]> {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserRolesInOrg(userId, orgId)
  }

  static async getUserMenuPermissionsInOrg(userId: number, orgId: number): Promise<UserMenuPermission[]> {
    // admin 直接全开
    if (await MenuRepository.isUserAdminInOrg(userId, orgId)) {
      const menus = await MenuRepository.findAllMenus()
      return menus
        .filter(m => !m.is_disabled)
        .map<UserMenuPermission>(m => ({
          menu_id: m.id,
          menu_name: m.name,
          menu_title: m.title,
          path: m.path,
          component: m.component,
          icon: m.icon,
          parent_id: m.parent_id,
          sort_order: m.sort_order,
          level: m.level,
          menu_type: m.menu_type,
          permission_code: m.permission_code,
          redirect: m.redirect,
          meta: m.meta ? (typeof m.meta === 'string' ? JSON.parse(m.meta) : m.meta) : null,
          has_permission: true,
          permission_source: 'admin',
        }))
    }

    // 非 admin 走合并查询
    const rows = await MenuRepository.queryUserMenuPermissionRows(userId, orgId)
    return (rows as any[]).map<UserMenuPermission>(r => ({
      menu_id: r.menu_id,
      menu_name: r.menu_name,
      menu_title: r.menu_title,
      path: r.path ?? null,
      component: r.component ?? null,
      icon: r.icon ?? null,
      parent_id: r.parent_id ?? null,
      sort_order: r.sort_order,
      level: r.level,
      menu_type: r.menu_type,
      permission_code: r.permission_code ?? null,
      redirect: r.redirect ?? null,
      meta: r.meta ? (typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta) : null,
      has_permission: !!r.has_permission,
      permission_source: r.permission_source,
    }))
  }

  static async getUserMenuPermissions(userId: number): Promise<UserMenuPermission[]> {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserMenuPermissionsInOrg(userId, orgId)
  }

  static async getUserMenuTree(userId: number) {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserMenuTreeInOrg(userId, orgId)
  }

  static async getUserMenuTreeInOrg(userId: number, orgId: number) {
    const perms = await this.getUserMenuPermissionsInOrg(userId, orgId)
    const menus: Menu[] = perms
      .filter(p => p.has_permission)
      .map(p => ({
        id: p.menu_id,
        name: p.menu_name,
        title: p.menu_title,
        path: p.path,
        component: p.component,
        icon: p.icon,
        parent_id: p.parent_id,
        sort_order: p.sort_order,
        level: p.level,
        is_hidden: false,
        is_disabled: false,
        is_system: false,
        menu_type: p.menu_type,
        permission_code: p.permission_code,
        redirect: p.redirect,
        meta: p.meta,
        created_at: '' as any,
        updated_at: '' as any,
      }))
    return this.buildMenuTree(menus)
  }

  static async checkUserMenuPermissionInOrg(userId: number, orgId: number, menuId: number) {
    // admin 快路
    if (await MenuRepository.isUserAdminInOrg(userId, orgId)) {
      return MenuRepository.menuExistsAndEnabled(menuId)
    }
    return MenuRepository.checkUserMenuPermissionInOrg(userId, orgId, menuId)
  }

  static async checkUserMenuPermission(userId: number, menuId: number) {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) return false
    return this.checkUserMenuPermissionInOrg(userId, orgId, menuId)
  }

  static async setUserMenuPermission(
    userId: number,
    menuId: number,
    permissionType: 'grant' | 'deny'
  ): Promise<boolean> {
    return MenuRepository.upsertUserMenuPermission(userId, menuId, permissionType)
  }

  static async removeUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
    return MenuRepository.deleteUserMenuPermission(userId, menuId)
  }
}
