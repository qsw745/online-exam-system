import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { CreateRoleRequest, Role, UpdateRoleRequest } from '../models/menu.model.js'

export class RoleService {
  /** 从角色移除一个用户 */
  static async removeUserFromRole(roleId: number, userId: number): Promise<void> {
    // 确认角色存在
    const [r] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE id = ?', [roleId])
    if (r.length === 0) throw new Error('角色不存在')

    // 可选：确认用户存在
    const [u] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [userId])
    if (u.length === 0) throw new Error('用户不存在')

    // 删除关系
    const [ret] = await pool.execute<ResultSetHeader>('DELETE FROM user_roles WHERE role_id = ? AND user_id = ?', [
      roleId,
      userId,
    ])

    // 如果没有删除到任何行，说明关系原本不存在
    if (ret.affectedRows === 0) {
      throw new Error('该用户不在此角色中')
    }
  }

  /**
   * 获取所有角色
   */
  static async getAllRoles(): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles ORDER BY is_system DESC, created_at ASC')
    return rows as Role[]
  }

  /**
   * 分页获取角色列表（支持搜索）
   */
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
      const searchTerm = `%${keyword.trim()}%`
      searchParams = [searchTerm, searchTerm]
    }

    // 获取总数
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM roles ${whereClause}`,
      searchParams
    )
    const total = countRows[0].total

    // 获取分页数据
    const limitValue = Number(pageSize)
    const offsetValue = Number(offset)

    let rows
    if (searchParams.length > 0) {
      // 有搜索条件时使用参数化查询
      ;[rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM roles ${whereClause} ORDER BY is_system DESC, created_at ASC LIMIT ${limitValue} OFFSET ${offsetValue}`,
        searchParams
      )
    } else {
      // 无搜索条件时使用直接查询
      ;[rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM roles ORDER BY is_system DESC, created_at ASC LIMIT ${limitValue} OFFSET ${offsetValue}`
      )
    }

    return {
      roles: rows as Role[],
      total,
    }
  }

  /**
   * 根据ID获取角色
   */
  static async getRoleById(id: number): Promise<Role | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM roles WHERE id = ?', [id])
    return rows.length > 0 ? (rows[0] as Role) : null
  }

  /**
   * 创建角色
   */
  static async createRole(roleData: CreateRoleRequest): Promise<Role> {
    const { name, description, sort_order, is_disabled = false } = roleData
    let { code } = roleData

    // 检查角色名称是否已存在
    const [existingRoles] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE name = ?', [name])

    if (existingRoles.length > 0) {
      throw new Error('角色名称已存在，请使用其他名称')
    }

    // 如果没有提供角色编码，则自动生成
    if (!code || code.trim() === '') {
      code = await this.generateRoleCode(name)
    } else {
      // 检查角色编码是否已存在
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ?', [code])

      if (existingCodes.length > 0) {
        throw new Error('角色编码已存在，请使用其他编码')
      }
    }

    // 如果没有指定排序号，则获取当前最大排序号+1
    let finalSortOrder = sort_order
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const [maxSortRows] = await pool.execute<RowDataPacket[]>('SELECT MAX(sort_order) as max_sort FROM roles')
      const maxSort = maxSortRows[0]?.max_sort || 0
      finalSortOrder = maxSort + 1
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO roles (name, code, description, sort_order, is_disabled) VALUES (?, ?, ?, ?, ?)',
      [name, code, description, finalSortOrder, is_disabled]
    )

    const role = await this.getRoleById(result.insertId)
    if (!role) {
      throw new Error('创建角色失败')
    }

    return role
  }

  /**
   * 更新角色
   */
  static async updateRole(id: number, roleData: UpdateRoleRequest): Promise<Role | null> {
    const role = await this.getRoleById(id)
    if (!role) {
      return null
    }

    // 系统角色不允许修改某些字段
    if (role.is_system && roleData.name) {
      throw new Error('系统角色不允许修改名称')
    }

    const updateFields: string[] = []
    const updateValues: any[] = []

    if (roleData.name !== undefined && !role.is_system) {
      updateFields.push('name = ?')
      updateValues.push(roleData.name)
    }

    if (roleData.code !== undefined && !role.is_system) {
      // 检查角色编码是否已存在
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ? AND id != ?', [
        roleData.code,
        id,
      ])

      if (existingCodes.length > 0) {
        throw new Error('角色编码已存在，请使用其他编码')
      }

      updateFields.push('code = ?')
      updateValues.push(roleData.code)
    }

    if (roleData.description !== undefined) {
      updateFields.push('description = ?')
      updateValues.push(roleData.description)
    }

    if (roleData.is_disabled !== undefined) {
      updateFields.push('is_disabled = ?')
      updateValues.push(roleData.is_disabled)
    }

    if (updateFields.length === 0) {
      return role
    }

    updateValues.push(id)

    await pool.execute(
      `UPDATE roles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      updateValues
    )

    return await this.getRoleById(id)
  }

  /**
   * 删除角色
   */
  static async deleteRole(id: number): Promise<boolean> {
    const role = await this.getRoleById(id)
    if (!role) {
      return false
    }

    // 系统角色不允许删除
    if (role.is_system) {
      throw new Error('系统角色不允许删除')
    }

    // 检查是否有用户使用此角色
    const [userRoles] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    )

    if (userRoles[0].count > 0) {
      throw new Error('该角色正在被用户使用，无法删除')
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM roles WHERE id = ?', [id])

    return result.affectedRows > 0
  }

  /**
   * 获取角色的菜单权限
   */
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

  /**
   * 设置角色的菜单权限
   */
  static async setRoleMenus(roleId: number, menuIds: number[]): Promise<void> {
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
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 获取用户的角色
   */
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

  /**
   * 设置用户的角色
   */
  static async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // 删除现有角色
      await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])

      // 添加新角色
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

  /**
   * 检查用户是否拥有指定角色
   */
  static async userHasRole(userId: number, roleId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND ur.role_id = ? AND r.is_disabled = FALSE`,
      [userId, roleId]
    )
    return rows[0].count > 0
  }

  /**
   * 检查用户是否拥有任一指定角色
   */
  static async userHasAnyRole(userId: number, roleIds: number[]): Promise<boolean> {
    if (roleIds.length === 0) return false

    const placeholders = roleIds.map(() => '?').join(',')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND ur.role_id IN (${placeholders}) AND r.is_disabled = FALSE`,
      [userId, ...roleIds]
    )
    return rows[0].count > 0
  }

  /**
   * 获取角色的用户列表
   */
  static async getRoleUsers(roleId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        u.id,
        u.username,
        u.email,
        ur.assigned_at AS assigned_at
    FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role_id = ?
    ORDER BY ur.assigned_at DESC
`,
      [roleId]
    )
    return rows
  }

  /**
   * 获取下一个排序号
   */
  static async getNextSortOrder(): Promise<number> {
    const [maxSortRows] = await pool.execute<RowDataPacket[]>('SELECT MAX(sort_order) as max_sort FROM roles')
    const maxSort = maxSortRows[0]?.max_sort || 0
    return maxSort + 1
  }

  /**
   * 自动生成角色编码
   */
  static async generateRoleCode(name: string): Promise<string> {
    // 基于角色名称生成编码
    let baseCode = name
      .toLowerCase()
      .replace(/[\s\u4e00-\u9fa5]+/g, '_') // 将空格和中文字符替换为下划线
      .replace(/[^a-z0-9_]/g, '') // 移除非字母数字下划线字符
      .replace(/_+/g, '_') // 合并多个下划线
      .replace(/^_|_$/g, '') // 移除首尾下划线

    // 如果生成的编码为空，使用默认前缀
    if (!baseCode) {
      baseCode = 'role'
    }

    // 检查编码是否已存在，如果存在则添加数字后缀
    let code = baseCode
    let counter = 1

    while (true) {
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code = ?', [code])

      if (existingCodes.length === 0) {
        break
      }

      code = `${baseCode}_${counter}`
      counter++
    }

    return code
  }

  /**
   * 添加用户到角色
   */
  static async addUsersToRole(roleId: number, userIds: number[]): Promise<void> {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // 检查角色是否存在
      const role = await this.getRoleById(roleId)
      if (!role) {
        throw new Error('角色不存在')
      }

      // 检查用户是否存在并过滤掉已经分配给该角色的用户
      const [existingUsers] = await connection.execute<RowDataPacket[]>(
        `SELECT u.id FROM users u 
         LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.role_id = ?
         WHERE u.id IN (${userIds.map(() => '?').join(',')}) AND ur.user_id IS NULL`,
        [roleId, ...userIds]
      )

      const validUserIds = existingUsers.map((user: any) => user.id)

      if (validUserIds.length === 0) {
        throw new Error('没有可添加的用户（用户不存在或已分配给该角色）')
      }

      // 批量添加用户到角色
      const placeholders = validUserIds.map(() => '(?, ?)').join(', ')
      const values = validUserIds.flatMap(userId => [userId, roleId])
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
