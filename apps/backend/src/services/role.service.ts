import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { CreateRoleRequest, Role, UpdateRoleRequest } from '../models/menu.model.js'

/** 工具：把 undefined 统一转成 null（MySQL 可接受） */
function u2n<T>(v: T | undefined): T | null {
  return (typeof v === 'undefined' ? null : (v as any)) as any
}
/** 工具：把布尔/数字/字符串转 tinyint(1) 0/1 */
function toTinyint(v: any): 0 | 1 {
  if (v === true || v === 1 || v === '1' || v === 'true') return 1
  return 0
}
/** 工具：安全的数字（给 sort_order 用） */
function toIntOrDefault(v: any, dflt: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : dflt
}

export class RoleService {
  /** 从角色移除一个用户 */
  static async removeUserFromRole(roleId: number, userId: number): Promise<void> {
    const [r] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE id = ?', [roleId])
    if (r.length === 0) throw new Error('角色不存在')

    const [u] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [userId])
    if (u.length === 0) throw new Error('用户不存在')

    const [ret] = await pool.execute<ResultSetHeader>('DELETE FROM user_roles WHERE role_id = ? AND user_id = ?', [
      roleId,
      userId,
    ])
    if (ret.affectedRows === 0) throw new Error('该用户不在此角色中')
  }

  /** 获取所有角色 */
  static async getAllRoles(): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles ORDER BY is_system DESC, created_at ASC')
    return rows as Role[]
  }

  /** 分页+搜索 */
  static async getRolesWithPagination(
    page: number,
    pageSize: number,
    keyword?: string
  ): Promise<{ roles: Role[]; total: number }> {
    const offset = (page - 1) * pageSize

    let whereClause = ''
    let searchParams: any[] = []

    if (keyword && keyword.trim()) {
      whereClause = 'WHERE name LIKE ? OR description LIKE ?'
      const s = `%${keyword.trim()}%`
      searchParams = [s, s]
    }

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM roles ${whereClause}`,
      searchParams
    )
    const total = Number(countRows[0]?.total || 0)

    const limitValue = Number(pageSize)
    const offsetValue = Number(offset)

    let rows: RowDataPacket[]
    if (searchParams.length > 0) {
      ;[rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM roles ${whereClause} ORDER BY is_system DESC, created_at ASC LIMIT ${limitValue} OFFSET ${offsetValue}`,
        searchParams
      )
    } else {
      ;[rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM roles ORDER BY is_system DESC, created_at ASC LIMIT ${limitValue} OFFSET ${offsetValue}`
      )
    }

    return { roles: rows as Role[], total }
  }

  /** 根据ID获取角色 */
  static async getRoleById(id: number): Promise<Role | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [id])
    return rows.length > 0 ? (rows[0] as Role) : null
  }

  /** 创建角色（修复 undefined 传参问题） */
  static async createRole(roleData: CreateRoleRequest): Promise<Role> {
    // 1) 取值并规范化
    const rawName = String(roleData?.name ?? '').trim()
    if (!rawName) throw new Error('角色名称不能为空')

    let code = typeof roleData?.code === 'string' ? roleData.code.trim() : ''
    const description = u2n(roleData?.description) // undefined -> null
    const is_disabled = toTinyint(roleData?.is_disabled) // -> 0/1

    // 2) 名称唯一
    const [existingRoles] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE name = ?', [rawName])
    if (existingRoles.length > 0) throw new Error('角色名称已存在，请使用其他名称')

    // 3) 生成/校验编码
    if (!code) {
      code = await this.generateRoleCode(rawName)
    } else {
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ?', [code])
      if (existingCodes.length > 0) throw new Error('角色编码已存在，请使用其他编码')
    }

    // 4) 排序号
    let finalSortOrder = roleData?.sort_order
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const [maxSortRows] = await pool.execute<RowDataPacket[]>('SELECT MAX(sort_order) as max_sort FROM roles')
      const maxSort = Number(maxSortRows[0]?.max_sort || 0)
      finalSortOrder = maxSort + 1
    }
    finalSortOrder = toIntOrDefault(finalSortOrder, 1)

    // 5) 插入（确保所有参数都不是 undefined）
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO roles (name, code, description, sort_order, is_disabled) VALUES (?, ?, ?, ?, ?)',
      [rawName, code, description, finalSortOrder, is_disabled]
    )

    const role = await this.getRoleById(result.insertId)
    if (!role) throw new Error('创建角色失败')
    return role
  }

  /** 更新角色（同样规避 undefined） */
  static async updateRole(id: number, roleData: UpdateRoleRequest): Promise<Role | null> {
    const role = await this.getRoleById(id)
    if (!role) return null

    if (role.is_system && roleData.name) throw new Error('系统角色不允许修改名称')

    const updateFields: string[] = []
    const updateValues: any[] = []

    if (roleData.name !== undefined && !role.is_system) {
      updateFields.push('name = ?')
      updateValues.push(String(roleData.name).trim())
    }

    if (roleData.code !== undefined && !role.is_system) {
      const newCode = String(roleData.code).trim()
      if (!newCode) throw new Error('角色编码不能为空')
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ? AND id != ?', [
        newCode,
        id,
      ])
      if (existingCodes.length > 0) throw new Error('角色编码已存在，请使用其他编码')
      updateFields.push('code = ?')
      updateValues.push(newCode)
    }

    if (roleData.description !== undefined) {
      updateFields.push('description = ?')
      updateValues.push(u2n(roleData.description))
    }

    if (roleData.is_disabled !== undefined) {
      updateFields.push('is_disabled = ?')
      updateValues.push(toTinyint(roleData.is_disabled))
    }

    if (roleData.sort_order !== undefined) {
      updateFields.push('sort_order = ?')
      updateValues.push(toIntOrDefault(roleData.sort_order, role.sort_order ?? 1))
    }

    if (updateFields.length === 0) return role

    updateValues.push(id)
    await pool.execute(
      `UPDATE roles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    )

    return await this.getRoleById(id)
  }

  /** 删除角色 */
  static async deleteRole(id: number): Promise<boolean> {
    const role = await this.getRoleById(id)
    if (!role) return false
    if (role.is_system) throw new Error('系统角色不允许删除')

    const [userRoles] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    )
    if (Number(userRoles[0]?.count || 0) > 0) throw new Error('该角色正在被用户使用，无法删除')

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM roles WHERE id = ?', [id])
    return result.affectedRows > 0
  }

  /** 获取角色的菜单权限 */
  static async getRoleMenus(roleId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.id, m.name, m.title, m.path, m.icon, m.parent_id, m.sort_order
       FROM role_menus rm
       JOIN menus m ON rm.menu_id = m.id
       WHERE rm.role_id = ?
       ORDER BY m.sort_order, m.id`,
      [roleId]
    )
    return rows
  }

  /** 设置角色菜单权限 */
  static async setRoleMenus(roleId: number, menuIds: number[]): Promise<void> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute('DELETE FROM role_menus WHERE role_id = ?', [roleId])

      if (menuIds.length > 0) {
        const placeholders = menuIds.map(() => '(?, ?)').join(', ')
        const values = menuIds.flatMap(menuId => [roleId, menuId])
        await connection.execute(`INSERT INTO role_menus (role_id, menu_id) VALUES ${placeholders}`, values)
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /** 获取用户的角色 */
  static async getUserRoles(userId: number): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.* FROM roles r 
       INNER JOIN user_roles ur ON r.id = ur.role_id 
       WHERE ur.user_id = ? 
       ORDER BY r.is_system DESC, r.created_at ASC`,
      [userId]
    )
    return rows as Role[]
  }

  /** 设置用户的角色 */
  static async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])

      if (roleIds.length > 0) {
        const placeholders = roleIds.map(() => '(?, ?)').join(', ')
        const values = roleIds.flatMap(roleId => [userId, roleId])
        await connection.execute(`INSERT INTO user_roles (user_id, role_id) VALUES ${placeholders}`, values)
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /** 用户是否拥有指定角色 */
  static async userHasRole(userId: number, roleId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND ur.role_id = ? AND r.is_disabled = FALSE`,
      [userId, roleId]
    )
    return Number(rows[0]?.count || 0) > 0
  }

  /** 用户是否拥有任一角色 */
  static async userHasAnyRole(userId: number, roleIds: number[]): Promise<boolean> {
    if (roleIds.length === 0) return false
    const placeholders = roleIds.map(() => '?').join(',')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND ur.role_id IN (${placeholders}) AND r.is_disabled = FALSE`,
      [userId, ...roleIds]
    )
    return Number(rows[0]?.count || 0) > 0
  }

  /** 获取角色下的用户 */
  static async getRoleUsers(roleId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, ur.assigned_at AS assigned_at
       FROM users u
       INNER JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role_id = ?
       ORDER BY ur.assigned_at DESC`,
      [roleId]
    )
    return rows
  }

  /** 获取下一个排序号 */
  static async getNextSortOrder(): Promise<number> {
    const [maxSortRows] = await pool.execute<RowDataPacket[]>('SELECT MAX(sort_order) as max_sort FROM roles')
    const maxSort = Number(maxSortRows[0]?.max_sort || 0)
    return maxSort + 1
  }

  /** 自动生成角色编码 */
  static async generateRoleCode(name: string): Promise<string> {
    let baseCode = name
      .toLowerCase()
      .replace(/[\s\u4e00-\u9fa5]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    if (!baseCode) baseCode = 'role'

    let code = baseCode
    let counter = 1
    // 防重复
    while (true) {
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ?', [code])
      if (existingCodes.length === 0) break
      code = `${baseCode}_${counter++}`
    }
    return code
  }

  /** 批量把用户加入角色 */
  static async addUsersToRole(roleId: number, userIds: number[]): Promise<void> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const role = await this.getRoleById(roleId)
      if (!role) throw new Error('角色不存在')

      if (userIds.length === 0) throw new Error('没有可添加的用户')

      const [existingUsers] = await connection.execute<RowDataPacket[]>(
        `SELECT u.id
         FROM users u 
         LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.role_id = ?
         WHERE u.id IN (${userIds.map(() => '?').join(',')}) AND ur.user_id IS NULL`,
        [roleId, ...userIds]
      )
      const validUserIds = (existingUsers as any[]).map(x => x.id)
      if (validUserIds.length === 0) throw new Error('没有可添加的用户（用户不存在或已分配给该角色）')

      const placeholders = validUserIds.map(() => '(?, ?)').join(', ')
      const values = validUserIds.flatMap(uid => [uid, roleId])
      await connection.execute(`INSERT INTO user_roles (user_id, role_id) VALUES ${placeholders}`, values)

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}
