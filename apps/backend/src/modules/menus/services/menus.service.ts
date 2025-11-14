/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { MenuRepository, type MenuUpdate } from '../repositories/menu.repository.js'
import { UnitRepo } from '../repositories/unit-menu.repository.js'

// --- Redis helpers (tolerant) ---
let RC: any = null
;(async () => {
  try {
    const mod = await import('@/common/redis/cache')
    RC = (mod as any).default ?? mod
  } catch {}
})()

const MENUS_TTL = 600
// 可通过环境变量在发布后全量失效缓存，例如导出 MENUS_CACHE_VER=2025-10-08
const CACHE_VER = process.env.MENUS_CACHE_VER || 'v2'
// ⚠️ 修正：默认严格模式 true（避免意外放通全量菜单）
const DEFAULT_STRICT = true

// 统一 key 生成：永远带上 strict 维度与版本号，避免命中旧缓存
const k = {
  perm: (uid: number, orgId: number, strict: boolean) => `perm:${CACHE_VER}:${uid}:${orgId}:${strict ? 1 : 0}`,
  tree: (uid: number, orgId: number, strict: boolean) => `menuTree:${CACHE_VER}:${uid}:${orgId}:${strict ? 1 : 0}`,
  scopeTree: (scope?: '' | 'system' | 'unit', unitId?: number) =>
    `menuTree:scope:${CACHE_VER}:${scope || 'all'}:${unitId ?? 'all'}`,
}

async function cget<T = any>(key: string, nocache?: boolean): Promise<T | null> {
  if (nocache) return null
  try {
    const v = await RC?.get?.(key)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(key: string, val: any, ttl = MENUS_TTL, nocache?: boolean) {
  if (nocache) return
  try {
    await RC?.set?.(key, JSON.stringify(val), ttl)
  } catch {}
}
async function cdelByPattern(pat: string) {
  try {
    const ks = await RC?.keys?.(pat)
    if (ks?.length) await RC?.del?.(ks)
  } catch {}
}

type ScopeArgs = { scope?: '' | 'system' | 'unit'; unitId?: number }
type BuildOpts = { strict?: boolean; nocache?: boolean }

function ensurePath(p?: string | null, name?: string | null, redirect?: string | null): string | null {
  const clean = (v?: string | null) => {
    const t = (v ?? '').trim()
    return t ? t : null
  }
  const nm = clean(name)
  return clean(p) ?? clean(redirect) ?? (nm ? `/${nm}` : null)
}
function toNumOrNull(v: any): number | null {
  return v == null || v === '' ? null : Number(v)
}

/** ✅ 修正点：严格解释 SQL 返回的 0/1，且默认 **false**，不再默认 true */
function permFromRow(r: any): UserMenuPermission {
  // MySQL 常会把布尔返回为 0/1（数字/字符串）
  const hasFromSql =
    r.has_permission !== undefined && r.has_permission !== null ? Number(r.has_permission) === 1 : undefined

  const hasFromUserOverride = r.permission_type != null ? String(r.permission_type).toLowerCase() !== 'deny' : undefined

  // 优先使用 SQL 计算列，其次看用户覆写；都没有时默认 false（之前是 true，导致全量放开）
  const hasPerm = hasFromSql ?? hasFromUserOverride ?? false

  const id = Number(r.menu_id ?? r.id)
  return {
    menu_id: id,
    menu_name: r.menu_name ?? r.name ?? '',
    menu_title: r.menu_title ?? r.title ?? r.name ?? '',
    menu_type: (r.menu_type ?? r.type ?? 'menu') as any,
    parent_id: r.parent_id == null ? null : Number(r.parent_id),
    sort_order: Number(r.sort_order ?? 0),
    level: Number(r.level ?? 0),
    path: ensurePath(r.path, r.menu_name ?? r.name, r.redirect),
    component: r.component ?? null,
    icon: r.icon ?? null,
    permission_code: r.permission_code ?? null,
    redirect: r.redirect ?? null,
    meta: r.meta ?? null,
    has_permission: hasPerm,
  } as UserMenuPermission
}

export class MenuService {
  /** 计算 level */
  private static async calcLevel(parent_id?: number | null): Promise<number> {
    if (!parent_id) return 1
    const p = await MenuRepository.findMenuById(parent_id)
    return p ? Number(p.level || 0) + 1 : 1
  }
  /** 系统菜单：创建 */
  static async createSystemMenu(payload: any): Promise<number> {
    const level = await this.calcLevel(payload.parent_id ?? null)
    return MenuRepository.insertMenu({
      ...payload,
      level,
      is_system: true,
    })
  }
  /** 系统菜单：更新（会自动纠正 level） */
  static async updateSystemMenu(payload: any): Promise<boolean> {
    const { id, parent_id } = payload
    const level = await this.calcLevel(parent_id ?? null)
    return MenuRepository.updateMenu({ ...payload, id, level })
  }

  /** 系统菜单：删除（禁止删除有子级的） */
  static async deleteSystemMenu(id: number): Promise<boolean> {
    const childCount = await MenuRepository.countChildren(id)
    if (childCount > 0) throw new Error('无法删除包含子菜单的菜单')
    return MenuRepository.deleteMenu(id)
  }
  // ---- Menus
  static async getAllMenus(args: ScopeArgs = {}): Promise<Menu[]> {
    const { scope, unitId } = args
    if (scope === 'system') return MenuRepository.findMenusByFilter({ is_system: 1 })
    if (scope === 'unit') {
      if (!unitId) throw new Error('unitId required')
      return UnitRepo.findOverridesAsMenus(unitId)
    }
    return MenuRepository.findAllMenus()
  }

  private static buildMenuTree(menus: Menu[], parentId: number | null = null): MenuTreeNode[] {
    const pid = toNumOrNull(parentId)
    const nodes: MenuTreeNode[] = []
    for (const raw of menus) {
      const m: Menu = {
        ...raw,
        id: Number(raw.id),
        parent_id: toNumOrNull(raw.parent_id),
        sort_order: Number(raw.sort_order ?? 0),
      }
      if (m.parent_id === pid) nodes.push({ ...m, children: this.buildMenuTree(menus, m.id) })
    }
    return nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  static async getMenuTree(args: ScopeArgs = {}): Promise<MenuTreeNode[]> {
    const ck = k.scopeTree(args.scope, args.unitId)
    const hit = await cget<MenuTreeNode[]>(ck)
    if (hit) return hit
    const menus = await this.getAllMenus(args)
    const tree = this.buildMenuTree(menus)
    await cset(ck, tree, 600)
    return tree
  }

  static async getMenuById(id: number): Promise<Menu | null> {
    return MenuRepository.findMenuById(id)
  }

  /** 单位菜单的“新增/编辑/删除”，不改系统表，只写覆盖 */
  static async createMenu(data: CreateMenuRequest & { unitId?: number; sys_menu_id?: number }): Promise<number> {
    if (!data.unitId || !data.sys_menu_id) throw new Error('unitId/sys_menu_id required')
    await UnitRepo.upsertUnitOverride(data.unitId, data.sys_menu_id, data as any)
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return data.sys_menu_id!
  }
  static async updateMenu(data: UpdateMenuRequest & { unitId?: number; sys_menu_id?: number }): Promise<boolean> {
    if (!data.unitId || !data.sys_menu_id) throw new Error('unitId/sys_menu_id required')
    await UnitRepo.upsertUnitOverride(data.unitId, data.sys_menu_id, data as any)
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return true
  }
  static async deleteMenu(id: number, unitId?: number, asUnit = false): Promise<boolean> {
    if (asUnit) {
      if (!unitId) throw new Error('unitId required')
      await UnitRepo.deleteUnitOverride(unitId, id)
      await cdelByPattern('menuTree:*')
      await cdelByPattern('perm:*')
      await cdelByPattern('menuTree:scope:*')
      return true
    }
    const cur = await MenuRepository.findMenuById(id)
    if (!cur || cur.is_system === false) return false
    const childCount = await MenuRepository.countChildren(id)
    if (childCount > 0) throw new Error('无法删除包含子菜单的系统菜单')
    return MenuRepository.deleteMenu(id)
  }
  static async batchUpdateMenuSort(updates: MenuUpdate[], args?: { scope?: 'system' | 'unit'; unitId?: number }) {
    if (!updates?.length) return true
    if (args?.scope === 'unit') {
      if (!args.unitId) throw new Error('unitId required')
      const mapped = updates.map(u => ({
        sys_menu_id: u.id,
        sort_order: u.sort_order,
        parent_sys_id: u.parent_id ?? null,
      }))
      await UnitRepo.batchUpsertSort(args.unitId, mapped)
      return true
    }
    await MenuRepository.batchUpdateSort(updates)
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
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
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return true
  }
  static async getRoleMenus(roleId: number): Promise<number[]> {
    return MenuRepository.getRoleMenuIds(roleId)
  }

  // ---- User & Org
  static async assignUserRolesInOrg(userId: number, orgId: number, roleIds: number[]): Promise<boolean> {
    await MenuRepository.replaceUserRolesInOrg(userId, orgId, roleIds)
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return true
  }
  static async getUserRolesInOrg(userId: number, orgId: number): Promise<Role[]> {
    return MenuRepository.findUserRolesInOrg(userId, orgId)
  }
  static async assignUserRoles(userId: number, roleIds: number[]): Promise<boolean> {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) throw new Error('用户没有主组织，无法分配角色')
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return this.assignUserRolesInOrg(userId, orgId, roleIds)
  }
  static async getUserRoles(userId: number): Promise<Role[]> {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserRolesInOrg(userId, orgId)
  }

  static async getUserMenuPermissionsInOrg(
    userId: number,
    orgId: number,
    opts?: BuildOpts
  ): Promise<UserMenuPermission[]> {
    const strict = opts?.strict ?? DEFAULT_STRICT
    const ck = k.perm(userId, orgId, strict)
    const hit = await cget<UserMenuPermission[]>(ck, opts?.nocache)
    if (hit) return hit

    const result = await (async () => {
      // 非 strict 模式：管理员放通全部（保持兼容）
      if (!strict && (await MenuRepository.isUserAdminInOrg(userId, orgId))) {
        const menus = await UnitRepo.findEffectiveMenusForUnit(orgId)
        return menus
          .filter(m => !m.is_disabled)
          .map(m =>
            permFromRow({
              id: m.id,
              name: m.name,
              title: m.title,
              menu_type: m.menu_type,
              parent_id: m.parent_id,
              sort_order: m.sort_order,
              level: m.level,
              path: m.path,
              component: m.component,
              icon: m.icon,
              permission_code: m.permission_code,
              redirect: m.redirect,
              meta: m.meta,
              has_permission: 1, // 显式 1
            })
          )
      }
      // 严格/普通用户：精确授权
      const rows = await MenuRepository.queryUserMenuPermissionRows(userId, orgId)
      return (rows as any[]).map(r => permFromRow(r))
    })()

    await cset(ck, result, 600, opts?.nocache)
    return result
  }

  static async getUserMenuPermissions(userId: number, opts?: BuildOpts): Promise<UserMenuPermission[]> {
    const orgId = await MenuRepository.getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserMenuPermissionsInOrg(userId, orgId, opts)
  }

  static async getUserMenuTree(userId: number, opts?: BuildOpts & { orgId?: number | null }) {
    let orgId: number | null | undefined = opts?.orgId
    if (orgId === undefined) {
      orgId = await MenuRepository.getPrimaryOrgId(userId)
    }
    if (orgId === null) return []
    if (!orgId) {
      orgId = await MenuRepository.findAnyOrgId()
    }
    if (!orgId) return []
    return this.getUserMenuTreeInOrg(userId, orgId, opts)
  }

  static async getUserMenuTreeInOrg(userId: number, orgId: number, opts?: BuildOpts) {
    const strict = opts?.strict ?? DEFAULT_STRICT
    const ck = k.tree(userId, orgId, strict)
    const hit = await cget<MenuTreeNode[]>(ck, opts?.nocache)
    if (hit) return hit

    // 1) 权限行
    const perms = await this.getUserMenuPermissionsInOrg(userId, orgId, opts)

    // 2) 过滤仅保留有权限 & 非 button
    const allowed = perms.filter(p => p.has_permission && p.menu_type !== 'button')

    // 3) 生效菜单（用于补齐祖先）
    const eff = await UnitRepo.findEffectiveMenusForUnit(orgId)
    const effMap = new Map<number, Menu>()
    for (const m of eff) {
      effMap.set(Number(m.id), {
        ...m,
        id: Number(m.id),
        parent_id: toNumOrNull(m.parent_id),
        sort_order: Number(m.sort_order ?? 0),
        level: Number(m.level ?? 0),
        path: ensurePath(m.path, m.name, m.redirect),
        component: m.component ?? null,
        icon: m.icon ?? null,
        permission_code: m.permission_code ?? null,
        redirect: m.redirect ?? null,
      } as Menu)
    }

    // 4) 放入已选节点
    const picked = new Map<number, Menu>()
    for (const p of allowed) {
      const id = Number(p.menu_id)
      picked.set(id, {
        id,
        name: p.menu_name,
        title: p.menu_title,
        path: ensurePath(p.path, p.menu_name, p.redirect),
        component: p.component ?? null,
        icon: p.icon ?? null,
        parent_id: toNumOrNull(p.parent_id),
        sort_order: Number(p.sort_order ?? 0),
        level: Number(p.level ?? 0),
        is_hidden: false,
        is_disabled: false,
        is_system: false,
        menu_type: p.menu_type as any,
        permission_code: p.permission_code ?? null,
        redirect: p.redirect ?? null,
        meta: p.meta ?? null,
        created_at: '' as any,
        updated_at: '' as any,
      } as unknown as Menu)
    }

    // 5) 祖先补齐（仅向上，不向下带子节点）
    const addAncestorChain = (startId: number) => {
      let cur = effMap.get(startId)
      while (cur && cur.parent_id != null) {
        const pid = Number(cur.parent_id)
        if (!picked.has(pid)) {
          const a = effMap.get(pid)
          if (a) picked.set(pid, a)
        }
        cur = effMap.get(pid)
      }
    }
    for (const p of allowed) addAncestorChain(Number(p.menu_id))

    // 6) 构建树
    const base = Array.from(picked.values())
    const tree = this.buildMenuTree(base)
    await cset(ck, tree, 600, opts?.nocache)
    return tree
  }

  static async checkUserMenuPermissionInOrg(userId: number, orgId: number, menuId: number) {
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
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return MenuRepository.upsertUserMenuPermission(userId, menuId, permissionType)
  }

  static async removeUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
    await cdelByPattern('menuTree:*')
    await cdelByPattern('perm:*')
    await cdelByPattern('menuTree:scope:*')
    return MenuRepository.deleteUserMenuPermission(userId, menuId)
  }
}
export default MenuService
