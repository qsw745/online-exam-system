import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import {
  CreateMenuRequest,
  CreateRoleRequest,
  Menu,
  MenuTreeNode,
  Role,
  UpdateMenuRequest,
  UpdateRoleRequest,
  UserMenuPermission,
} from '../models/menu.model.js'

// 从 userId 推断主组织（当没传 orgId 时兜底）
export async function getPrimaryOrgId(userId: number): Promise<number | null> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT org_id FROM user_organizations WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
    [userId]
  )
  return row?.org_id ?? null
}

// 判断用户在某 org 是否 admin
export async function isUserAdminInOrg(userId: number, orgId: number): Promise<boolean> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT 1
     FROM user_org_roles uor
     JOIN roles r ON r.id=uor.role_id
     WHERE uor.user_id=? AND uor.org_id=? AND r.code='admin' AND r.is_disabled=0
     LIMIT 1`,
    [userId, orgId]
  )
  return !!row
}
export class MenuService {
  // 获取所有菜单
  static async getAllMenus(): Promise<Menu[]> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM menus ORDER BY sort_order ASC, id ASC')
    return rows as Menu[]
  }

  // 获取菜单树结构
  static async getMenuTree(): Promise<MenuTreeNode[]> {
    const menus = await this.getAllMenus()
    return this.buildMenuTree(menus)
  }

  // 构建菜单树
  private static buildMenuTree(menus: Menu[], parentId: number | null = null): MenuTreeNode[] {
    const tree: MenuTreeNode[] = []

    for (const menu of menus) {
      if (menu.parent_id === parentId) {
        const node: MenuTreeNode = {
          ...menu,
          children: this.buildMenuTree(menus, menu.id),
        }
        tree.push(node)
      }
    }

    return tree.sort((a, b) => a.sort_order - b.sort_order)
  }

  // 根据ID获取菜单
  static async getMenuById(id: number): Promise<Menu | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM menus WHERE id = ?', [id])
    return rows.length > 0 ? (rows[0] as Menu) : null
  }

  // 创建菜单
  static async createMenu(menuData: CreateMenuRequest): Promise<number> {
    const {
      name,
      title,
      path,
      component,
      icon,
      parent_id,
      sort_order = 0,
      is_hidden = false,
      is_disabled = false,
      menu_type = 'menu',
      permission_code,
      redirect,
      meta,
      description,
    } = menuData

    // 计算菜单层级
    let level = 1
    if (parent_id) {
      const parentMenu = await this.getMenuById(parent_id)
      if (parentMenu) {
        level = parentMenu.level + 1
      }
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO menus (
        name, title, path, component, icon, parent_id, sort_order, level,
        is_hidden, is_disabled, is_system, menu_type, permission_code,
        redirect, meta, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        title,
        path || null,
        component || null,
        icon || null,
        parent_id || null,
        sort_order,
        level,
        is_hidden,
        is_disabled,
        false,
        menu_type,
        permission_code || null,
        redirect || null,
        meta ? JSON.stringify(meta) : null,
        description || null,
      ]
    )

    return result.insertId
  }

  // 更新菜单
  static async updateMenu(menuData: UpdateMenuRequest): Promise<boolean> {
    const { id, ...updateData } = menuData

    const fields = []
    const values = []

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`)
        if (key === 'meta' && value) {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
      }
    }

    if (fields.length === 0) {
      return false
    }

    values.push(id)

    const [result] = await pool.execute<ResultSetHeader>(`UPDATE menus SET ${fields.join(', ')} WHERE id = ?`, values)

    return result.affectedRows > 0
  }

  // 删除菜单
  static async deleteMenu(id: number): Promise<boolean> {
    // 检查是否为系统菜单
    const menu = await this.getMenuById(id)
    if (!menu || menu.is_system) {
      return false
    }

    // 检查是否有子菜单
    const [childRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM menus WHERE parent_id = ?', [
      id,
    ])

    if (childRows[0].count > 0) {
      throw new Error('无法删除包含子菜单的菜单项')
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM menus WHERE id = ?', [id])

    return result.affectedRows > 0
  }

  // 批量更新菜单排序
  static async batchUpdateMenuSort(
    menuUpdates: Array<{ id: number; sort_order: number; parent_id?: number }>
  ): Promise<boolean> {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      for (const update of menuUpdates) {
        const { id, sort_order, parent_id } = update

        if (parent_id !== undefined) {
          // 如果需要更新父级ID，同时更新排序和父级
          await connection.execute('UPDATE menus SET sort_order = ?, parent_id = ? WHERE id = ?', [
            sort_order,
            parent_id,
            id,
          ])
        } else {
          // 只更新排序
          await connection.execute('UPDATE menus SET sort_order = ? WHERE id = ?', [sort_order, id])
        }
      }

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      console.error('批量更新菜单排序失败:', error)
      return false
    } finally {
      connection.release()
    }
  }

  // 获取所有角色
  static async getAllRoles(): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles ORDER BY sort_order ASC, id ASC')
    return rows as Role[]
  }

  // 根据ID获取角色
  static async getRoleById(id: number): Promise<Role | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [id])
    return rows.length > 0 ? (rows[0] as Role) : null
  }

  // ✳️ 新：为用户在某组织分配角色（覆盖式）
  static async assignUserRolesInOrg(userId: number, orgId: number, roleIds: number[]): Promise<boolean> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute('DELETE FROM user_org_roles WHERE user_id=? AND org_id=?', [userId, orgId])

      if (roleIds.length > 0) {
        const placeholders = roleIds.map(() => '(?,?,?,NOW())').join(', ')
        const values = roleIds.flatMap(rid => [userId, orgId, rid])
        await conn.execute(
          `INSERT INTO user_org_roles (user_id, org_id, role_id, assigned_at) VALUES ${placeholders}`,
          values
        )
      }
      await conn.commit()
      return true
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // ✳️ 新：获取用户在某组织的角色
  static async getUserRolesInOrg(userId: number, orgId: number): Promise<Role[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*
     FROM user_org_roles uor
     JOIN roles r ON r.id=uor.role_id
     WHERE uor.user_id=? AND uor.org_id=? AND r.is_disabled=0
     ORDER BY r.sort_order ASC, r.id ASC`,
      [userId, orgId]
    )
    return rows as Role[]
  }

  // 兼容：旧方法（无 org）—> 取主组织再委托到 InOrg
  static async assignUserRoles(userId: number, roleIds: number[]): Promise<boolean> {
    const orgId = await getPrimaryOrgId(userId)
    if (!orgId) throw new Error('用户没有主组织，无法分配角色')
    return this.assignUserRolesInOrg(userId, orgId, roleIds)
  }

  static async getUserRoles(userId: number): Promise<Role[]> {
    const orgId = await getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserRolesInOrg(userId, orgId)
  }

  // 创建角色（修复：roles 有 code 列）
  static async createRole(roleData: CreateRoleRequest): Promise<number> {
    const { name, description, sort_order, code, is_system = false } = roleData as any

    if (!code) throw new Error('角色编码(code)必填且唯一')

    let finalSortOrder = sort_order
    if (finalSortOrder == null) {
      const [[maxRow]] = await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(sort_order),0) AS max_sort FROM roles')
      finalSortOrder = (maxRow?.max_sort || 0) + 1
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO roles (name, code, description, sort_order, is_system, is_disabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
      [name, code, description || null, finalSortOrder, !!is_system, false]
    )
    return result.insertId
  }

  // 更新角色
  static async updateRole(roleData: UpdateRoleRequest): Promise<boolean> {
    const { id, ...updateData } = roleData

    const fields = []
    const values = []

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (fields.length === 0) {
      return false
    }

    values.push(id)

    const [result] = await pool.execute<ResultSetHeader>(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, values)

    return result.affectedRows > 0
  }

  // 删除角色（不再检查 user_roles，改查 user_org_roles）
  static async deleteRole(id: number): Promise<boolean> {
    const role = await this.getRoleById(id)
    if (!role) return false
    if (role.is_system) throw new Error('系统角色不允许删除')

    const [[usingRow]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS cnt FROM user_org_roles WHERE role_id=?',
      [id]
    )
    if ((usingRow?.cnt || 0) > 0) {
      throw new Error('该角色正在被用户使用，无法删除')
    }

    const [res] = await pool.execute<ResultSetHeader>('DELETE FROM roles WHERE id=?', [id])
    return res.affectedRows > 0
  }

  // 为角色分配菜单权限
  static async assignRoleMenus(roleId: number, menuIds: number[]): Promise<boolean> {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // 删除现有权限
      await connection.execute('DELETE FROM role_menus WHERE role_id = ?', [roleId])

      // 添加新权限
      if (menuIds.length > 0) {
        const placeholders = menuIds.map(() => '(?, ?)').join(', ')
        const values = menuIds.flatMap(menuId => [roleId, menuId])
        await connection.execute(`INSERT INTO role_menus (role_id, menu_id) VALUES ${placeholders}`, values)
      }

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // 获取角色的菜单权限
  static async getRoleMenus(roleId: number): Promise<number[]> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT menu_id FROM role_menus WHERE role_id = ?', [roleId])
    return rows.map(row => row.menu_id)
  }

  // ✳️ 新：按组织取用户的菜单权限
  static async getUserMenuPermissionsInOrg(userId: number, orgId: number): Promise<UserMenuPermission[]> {
    const admin = await isUserAdminInOrg(userId, orgId)
    if (admin) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT m.*,
              TRUE AS has_permission,
              'admin' AS permission_source
       FROM menus m
       WHERE m.is_disabled = 0
       ORDER BY m.sort_order ASC, m.id ASC`
      )
      return rows.map(r => ({
        menu_id: r.id,
        menu_name: r.name,
        menu_title: r.title,
        path: r.path,
        component: r.component,
        icon: r.icon,
        parent_id: r.parent_id,
        sort_order: r.sort_order,
        level: r.level,
        menu_type: r.menu_type,
        permission_code: r.permission_code,
        redirect: r.redirect,
        meta: r.meta ? (typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta) : null,
        has_permission: true,
        permission_source: 'admin',
      }))
    }

    // 非 admin：基于 user_org_roles -> role_menus，再叠加 user_menus(个性化增/减)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT
        m.id           AS menu_id,
        m.name         AS menu_name,
        m.title        AS menu_title,
        m.path,
        m.component,
        m.icon,
        m.parent_id,
        m.sort_order,
        m.level,
        m.menu_type,
        m.permission_code,
        m.redirect,
        m.meta,
        CASE 
          WHEN um.permission_type='deny'  THEN FALSE
          WHEN um.permission_type='grant' THEN TRUE
          WHEN rm.menu_id IS NOT NULL     THEN TRUE
          ELSE FALSE
        END AS has_permission,
        CASE 
          WHEN um.permission_type='deny'  THEN 'deny'
          WHEN um.permission_type='grant' THEN 'user'
          WHEN rm.menu_id IS NOT NULL     THEN 'role'
          ELSE 'none'
        END AS permission_source
     FROM menus m
     LEFT JOIN user_menus um
       ON um.menu_id=m.id AND um.user_id=?
     LEFT JOIN (
        SELECT DISTINCT rm.menu_id
        FROM user_org_roles uor
        JOIN role_menus rm ON rm.role_id = uor.role_id
        WHERE uor.user_id=? AND uor.org_id=?
     ) rm ON rm.menu_id=m.id
     WHERE m.is_disabled=0
     ORDER BY m.sort_order ASC, m.id ASC`,
      [userId, userId, orgId]
    )

    return rows.map(row => ({
      ...row,
      meta: row.meta ? (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) : null,
      has_permission: !!row.has_permission,
    }))
  }

  // 兼容：不带 org 的旧方法
  static async getUserMenuPermissions(userId: number): Promise<UserMenuPermission[]> {
    const orgId = await getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserMenuPermissionsInOrg(userId, orgId)
  }

  static async getUserMenuTree(userId: number) {
    const orgId = await getPrimaryOrgId(userId)
    if (!orgId) return []
    return this.getUserMenuTreeInOrg(userId, orgId)
  }
  static async getUserMenuTreeInOrg(userId: number, orgId: number) {
    const perms: UserMenuPermission[] = await this.getUserMenuPermissionsInOrg(userId, orgId)

    const menus: Menu[] = perms
      .filter(p => p.has_permission)
      .map(
        p =>
          ({
            id: p.menu_id,
            name: p.menu_name,
            title: p.menu_title,
            path: p.path ?? null,
            component: p.component ?? null,
            icon: p.icon ?? null,
            parent_id: p.parent_id ?? null,
            sort_order: p.sort_order,
            level: p.level,
            is_hidden: false,
            is_disabled: false,
            is_system: false,
            menu_type: p.menu_type,
            permission_code: p.permission_code ?? null,
            redirect: p.redirect ?? null,
            meta: p.meta ?? null,
            created_at: '' as any, // 如果模型是 string，这里给个占位或改模型为可选
            updated_at: '' as any,
          } as Menu)
      )

    return this.buildMenuTree(menus)
  }

  static async checkUserMenuPermissionInOrg(userId: number, orgId: number, menuId: number) {
    const admin = await isUserAdminInOrg(userId, orgId)
    if (admin) {
      const [[ok]] = await pool.query<RowDataPacket[]>('SELECT id FROM menus WHERE id=? AND is_disabled=0 LIMIT 1', [
        menuId,
      ])
      return !!ok
    }

    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT
       CASE
         WHEN um.permission_type='deny'  THEN 0
         WHEN um.permission_type='grant' THEN 1
         WHEN rm.menu_id IS NOT NULL     THEN 1
         ELSE 0
       END AS has_permission
     FROM menus m
     LEFT JOIN user_menus um ON um.menu_id=m.id AND um.user_id=?
     LEFT JOIN (
       SELECT DISTINCT rm.menu_id
       FROM user_org_roles uor
       JOIN role_menus rm ON rm.role_id=uor.role_id
       WHERE uor.user_id=? AND uor.org_id=?
     ) rm ON rm.menu_id=m.id
     WHERE m.id=? AND m.is_disabled=0
     LIMIT 1`,
      [userId, userId, orgId, menuId]
    )
    return !!row?.has_permission
  }

  // 兼容：不带 org 的旧方法
  static async checkUserMenuPermission(userId: number, menuId: number) {
    const orgId = await getPrimaryOrgId(userId)
    if (!orgId) return false
    return this.checkUserMenuPermissionInOrg(userId, orgId, menuId)
  }

  // 为用户设置特定菜单权限
  static async setUserMenuPermission(
    userId: number,
    menuId: number,
    permissionType: 'grant' | 'deny'
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO user_menus (user_id, menu_id, permission_type) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type)`,
      [userId, menuId, permissionType]
    )

    return result.affectedRows > 0
  }

  // 移除用户特定菜单权限
  static async removeUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM user_menus WHERE user_id = ? AND menu_id = ?', [
      userId,
      menuId,
    ])

    return result.affectedRows > 0
  }
}
