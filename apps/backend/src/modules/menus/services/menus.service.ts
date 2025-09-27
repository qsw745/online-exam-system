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

type ScopeArgs = { scope?: '' | 'system' | 'unit'; unitId?: number }

function ensurePath(p?: string | null, name?: string | null, redirect?: string | null): string | undefined {
    if (p && typeof p === 'string' && p.trim()) return p.trim()
    if (redirect && typeof redirect === 'string' && redirect.trim()) return redirect.trim()
    if (name && typeof name === 'string' && name.trim()) return `/${name.trim()}`
    return undefined
}
function normalizeMeta(value: any): any | null {
    if (value == null) return null
    if (typeof value === 'string') {
        const t = value.trim()
        if (!t) return null
        try { return JSON.stringify(JSON.parse(t)) } catch { return null }
    }
    if (typeof value === 'object') {
        try { return JSON.stringify(value) } catch { return null }
    }
    return null
}

// 统一把 id/parent_id 转成 number|null，避免 "123" !== 123 导致全是一级
function toNumOrNull(v: any): number | null {
    return v === null || v === undefined || v === '' ? null : Number(v)
}

export class MenuService {
    // ---- Menus
    static async getAllMenus(args: ScopeArgs = {}): Promise<Menu[]> {
        const { scope, unitId } = args
        if (scope === 'system') return MenuRepository.findMenusByFilter({ is_system: 1 })

        if (scope === 'unit') {
            if (!unitId) throw new Error('unitId required')
            // 只看单位“覆盖项”，没有就返回空
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
            if (m.parent_id === pid) {
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
        if (!data.unitId || !data.sys_menu_id) throw new Error('unitId/sys_menu_id required')
        await UnitRepo.upsertUnitOverride(data.unitId, data.sys_menu_id, data as any)
        return data.sys_menu_id!
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
            const mapped = updates.map(u => ({
                sys_menu_id: u.id,
                sort_order: u.sort_order,
                parent_sys_id: u.parent_id ?? null,
            }))
            await UnitRepo.batchUpsertSort(args.unitId, mapped)
            return true
        }
        await MenuRepository.batchUpdateSort(updates)
        return true
    }

    // ---- Roles
    static async getAllRoles(): Promise<Role[]> { return MenuRepository.findAllRoles() }
    static async getRoleById(id: number): Promise<Role | null> { return MenuRepository.findRoleById(id) }
    static async createRole(data: CreateRoleRequest): Promise<number> {
        if (!data.code) throw new Error('角色编码(code)必填且唯一')
        const sort = data.sort_order ?? (await MenuRepository.maxRoleSort()) + 1
        return MenuRepository.insertRole({ ...data, sort_order: sort, is_system: !!data.is_system, is_disabled: false })
    }
    static async updateRole(data: UpdateRoleRequest): Promise<boolean> { return MenuRepository.updateRole(data) }
    static async deleteRole(id: number): Promise<boolean> {
        const role = await MenuRepository.findRoleById(id)
        if (!role) return false
        if (role.is_system) throw new Error('系统角色不允许删除')
        if (await MenuRepository.anyUserUsingRole(id)) throw new Error('该角色正在被用户使用，无法删除')
        return MenuRepository.deleteRole(id)
    }
    static async assignRoleMenus(roleId: number, menuIds: number[]): Promise<boolean> {
        await MenuRepository.replaceRoleMenus(roleId, menuIds); return true
    }
    static async getRoleMenus(roleId: number): Promise<number[]> {
        return MenuRepository.getRoleMenuIds(roleId)
    }

    // ---- User & Org
    static async assignUserRolesInOrg(userId: number, orgId: number, roleIds: number[]): Promise<boolean> {
        await MenuRepository.replaceUserRolesInOrg(userId, orgId, roleIds); return true
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
        // 管理员 / 超管：仍然按单位“生效菜单”直接放行（但不再注入任何静态路由）
        if (await MenuRepository.isUserAdminInOrg(userId, orgId)) {
            const menus = await UnitRepo.findEffectiveMenusForUnit(orgId)
            return menus
                .filter(m => !m.is_disabled)
                .map<UserMenuPermission>(m => ({
                    menu_id: Number(m.id),
                    menu_name: m.name,
                    menu_title: m.title,
                    path: ensurePath(m.path, m.name, m.redirect),
                    component: m.component ?? null,
                    icon: m.icon ?? null,
                    parent_id: toNumOrNull(m.parent_id),
                    sort_order: Number(m.sort_order ?? 0),
                    level: Number(m.level ?? 0),
                    menu_type: m.menu_type,
                    permission_code: m.permission_code ?? null,
                    redirect: m.redirect ?? null,
                    meta: typeof m.meta === 'string' ? (() => { try { return JSON.parse(m.meta) } catch { return null } })() : (m.meta ?? null),
                    has_permission: true,
                    permission_source: 'admin',
                }))
        }

        // 非管理员：合并角色+个性授权（SQL 已融合单位覆盖）
        const rows = await MenuRepository.queryUserMenuPermissionRows(userId, orgId)
        return (rows as any[]).map<UserMenuPermission>(r => ({
            menu_id: Number(r.menu_id),
            menu_name: r.menu_name,
            menu_title: r.menu_title,
            path: ensurePath(r.path, r.menu_name, r.redirect),
            component: r.component ?? null,
            icon: r.icon ?? null,
            parent_id: toNumOrNull(r.parent_id),
            sort_order: Number(r.sort_order ?? 0),
            level: Number(r.level ?? 0),
            menu_type: r.menu_type,
            permission_code: r.permission_code ?? null,
            redirect: r.redirect ?? null,
            meta: r.meta ? (typeof r.meta === 'string' ? (() => { try { return JSON.parse(r.meta) } catch { return null } })() : r.meta) : null,
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
        // 1) 先查用户在该单位的“权限行”
        const perms = await this.getUserMenuPermissionsInOrg(userId, orgId)

        // 2) 过滤掉 button，仅保留真正的导航项
        const allowed = perms.filter(p => p.has_permission && p.menu_type !== 'button')

        // 3) 取该单位的“生效菜单”（系统 ⊕ 最近覆盖），用来补齐祖先
        //    这里的 parent_id 已经是 COALESCE(override.parent_sys_id, system.parent_id)
        const eff = await UnitRepo.findEffectiveMenusForUnit(orgId)
        const effMap = new Map<number, Menu>()
        for (const m of eff) {
            effMap.set(Number(m.id), {
                ...m,
                id: Number(m.id),
                parent_id: m.parent_id == null ? null : Number(m.parent_id),
                sort_order: Number(m.sort_order ?? 0),
                level: Number(m.level ?? 0),
            })
        }

        // 4) 先把“有权限”的节点放进待渲染集合
        const picked = new Map<number, Menu>()
        const ensurePath = (p?: string | null, name?: string | null, redirect?: string | null) =>
            (p && String(p).trim()) ||
            (redirect && String(redirect).trim()) ||
            (name && String(name).trim() ? `/${String(name).trim()}` : undefined)

        for (const p of allowed) {
            const id = Number(p.menu_id)
            picked.set(id, {
                id,
                name: p.menu_name,
                title: p.menu_title,
                path: ensurePath(p.path, p.menu_name, p.redirect),
                component: p.component ?? undefined,
                icon: p.icon ?? undefined,
                parent_id: p.parent_id == null ? null : Number(p.parent_id),
                sort_order: Number(p.sort_order ?? 0),
                level: Number(p.level ?? 0),
                is_hidden: false,
                is_disabled: false,
                is_system: false,
                menu_type: p.menu_type as any,
                permission_code: p.permission_code ?? undefined,
                redirect: p.redirect ?? undefined,
                meta: p.meta ?? null,
                created_at: '' as any,
                updated_at: '' as any,
            })
        }

        // 5) 为每个已选节点“向上爬”，把缺失的祖先补齐为结构容器
        const addAncestorChain = (startId: number) => {
            let cur = effMap.get(startId)
            while (cur && cur.parent_id != null) {
                const pid = Number(cur.parent_id)
                if (!picked.has(pid)) {
                    const a = effMap.get(pid)
                    if (a) {
                        picked.set(pid, {
                            id: a.id,
                            name: a.name,
                            title: a.title,
                            path: ensurePath(a.path, a.name, a.redirect),
                            component: a.component ?? undefined,
                            icon: a.icon ?? undefined,
                            parent_id: a.parent_id == null ? null : Number(a.parent_id),
                            sort_order: Number(a.sort_order ?? 0),
                            level: Number(a.level ?? 0),
                            is_hidden: false,
                            is_disabled: false,
                            is_system: false,
                            menu_type: a.menu_type as any, // 可能是 'menu' 或 'link'
                            permission_code: a.permission_code ?? undefined,
                            redirect: a.redirect ?? undefined,
                            meta: a.meta ?? null,
                            created_at: '' as any,
                            updated_at: '' as any,
                        })
                    }
                }
                cur = effMap.get(pid)
            }
        }

        for (const p of allowed) addAncestorChain(Number(p.menu_id))

        // 6) 构建树
        const base = Array.from(picked.values())
        return this.buildMenuTree(base)
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
        return MenuRepository.upsertUserMenuPermission(userId, menuId, permissionType)
    }

    static async removeUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
        return MenuRepository.deleteUserMenuPermission(userId, menuId)
    }
}
