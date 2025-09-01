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

/** 规范化 code：小写、空格/中文→下划线、仅保留 a-z0-9_、去重下划线与首尾下划线 */
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

/** 409 业务错误 */
export class DuplicateCodeError extends Error {
  status = 409 as const
  constructor(msg = '角色编码已存在') {
    super(msg)
  }
}

export class RoleService {
  // ===== 在 RoleService 类里新增：缓存与工具 =====
  private static __ORG_TABLE_CACHE: string | null = null
  private static __ORG_NAME_COL_CACHE: string | null = null
  /** 解析机构表名：优先用环境变量 ORG_TABLE；否则在当前库内按候选表名自动探测一次并缓存 */
  private static async resolveOrgTableName(): Promise<string> {
    if (this.__ORG_TABLE_CACHE) return this.__ORG_TABLE_CACHE
    const envName = (process.env.ORG_TABLE || '').trim()
    if (envName) {
      this.__ORG_TABLE_CACHE = envName
      return envName
    }
    const candidates = ['orgs', 'organizations', 'organization', 'dept', 'depts', 'departments', 'sys_org', 'sys_orgs']
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT TABLE_NAME 
       FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND TABLE_NAME IN (${candidates.map(() => '?').join(',')}) 
      LIMIT 1`,
      candidates
    )
    if (rows.length === 0) {
      throw new Error('未找到机构表，请设置环境变量 ORG_TABLE 指向实际的机构表名')
    }
    const found = String(rows[0].TABLE_NAME)
    this.__ORG_TABLE_CACHE = found
    return found
  }
  /** 解析机构名称列名：在机构表中寻找最合适的名称字段，找不到则为 null（届时只返回 id） */
  private static async resolveOrgNameColumn(table: string): Promise<string | null> {
    if (this.__ORG_NAME_COL_CACHE) return this.__ORG_NAME_COL_CACHE
    const prefer = ['name', 'title', 'org_name', 'label', 'orgTitle', 'orgLabel']
    const [cols] = await pool.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME 
       FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
        AND table_name = ?`,
      [table]
    )
    const set = new Set((cols as any[]).map(c => String(c.COLUMN_NAME)))
    const hit = prefer.find(c => set.has(c)) || null
    this.__ORG_NAME_COL_CACHE = hit
    return hit
  }
  /** code 是否已存在（忽略大小写） */
  static async codeExists(code: string): Promise<boolean> {
    const norm = slugifyCode(code)
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE LOWER(code) = LOWER(?) LIMIT 1', [
      norm,
    ])
    return (rows as any[]).length > 0
  }

  /** 基于名称/初始 code 生成一个不冲突的编码（base, base_1, base_2...） */
  static async suggestUniqueCode(nameOrCode: string): Promise<string> {
    const base = slugifyCode(nameOrCode)
    let candidate = base
    let i = 0
    // 保险：防止极端并发，最多尝试 100 次
    while (await RoleService.codeExists(candidate)) {
      i += 1
      candidate = `${base}_${i}`
      if (i > 100) break
    }
    return candidate
  }

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
      whereClause = 'WHERE name LIKE ? OR description LIKE ? OR code LIKE ?'
      const s = `%${keyword.trim()}%`
      searchParams = [s, s, s]
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

  /** 创建角色：规范化 code + 唯一校验 + 409 语义化错误 */
  static async createRole(roleData: CreateRoleRequest): Promise<Role> {
    // 1) 取值并规范化
    const rawName = String(roleData?.name ?? '').trim()
    if (!rawName) throw new Error('角色名称不能为空')

    const rawCode = typeof roleData?.code === 'string' ? roleData.code.trim() : ''
    const description = u2n(roleData?.description) // undefined -> null
    const is_disabled = toTinyint(roleData?.is_disabled) // -> 0/1

    // 2) 名称是否已存在（可选，如果你希望允许重复名称可移除此段）
    const [existingRoles] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE name = ?', [rawName])
    if (existingRoles.length > 0) throw new Error('角色名称已存在，请使用其他名称')

    // 3) 生成/校验编码（避免与库中冲突）
    let code: string
    if (!rawCode) {
      code = await this.suggestUniqueCode(rawName)
    } else {
      code = slugifyCode(rawCode)
      const [existingCodes] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE LOWER(code) = LOWER(?)', [
        code,
      ])
      if (existingCodes.length > 0) throw new DuplicateCodeError('角色编码已存在，请使用其他编码')
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
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO roles (name, code, description, sort_order, is_disabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [rawName, code, description, finalSortOrder, is_disabled]
      )

      const role = await this.getRoleById(result.insertId)
      if (!role) throw new Error('创建角色失败')
      return role
    } catch (e: any) {
      // DB 唯一键错误（建议在 DB 有 UNIQUE(code)）
      if (e?.code === 'ER_DUP_ENTRY') {
        throw new DuplicateCodeError('角色编码已存在，请使用其他编码')
      }
      throw e
    }
  }

  /** 更新角色（同样规避 undefined；若允许改编码，同步唯一校验） */
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
      const newCodeRaw = String(roleData.code).trim()
      if (!newCodeRaw) throw new Error('角色编码不能为空')
      const newCode = slugifyCode(newCodeRaw)
      const [existingCodes] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM roles WHERE LOWER(code) = LOWER(?) AND id != ?',
        [newCode, id]
      )
      if (existingCodes.length > 0) throw new DuplicateCodeError('角色编码已存在，请使用其他编码')
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
    try {
      await pool.execute(
        `UPDATE roles SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      )
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        throw new DuplicateCodeError('角色编码已存在，请使用其他编码')
      }
      throw e
    }

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

  /** 自动生成角色编码（兼容旧调用） */
  static async generateRoleCode(name: string): Promise<string> {
    return this.suggestUniqueCode(name)
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

  // ===== 角色 ⇄ 机构（替换你现有的三个方法） =====
  /** 获取角色已关联的机构列表（id 与可用的 name） */
  static async getRoleOrgs(roleId: number): Promise<Array<{ id: number; name?: string }>> {
    const [roleRows] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE id = ?', [roleId])
    if (roleRows.length === 0) throw new Error('角色不存在')

    const orgTable = await this.resolveOrgTableName()
    const nameCol = await this.resolveOrgNameColumn(orgTable)

    let sql = `SELECT o.id`
    if (nameCol) sql += `, o.\`${nameCol}\` AS name`
    sql += ` FROM role_orgs ro JOIN \`${orgTable}\` o ON o.id = ro.org_id WHERE ro.role_id = ? ORDER BY o.id`

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [roleId])
    return rows as any
  }

  /** 批量添加机构到角色（去重，只添加未存在的） */
  static async addOrgsToRole(roleId: number, orgIds: number[]): Promise<number> {
    if (!Array.isArray(orgIds) || orgIds.length === 0) return 0

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [roleRows] = await conn.execute<RowDataPacket[]>('SELECT id FROM roles WHERE id = ?', [roleId])
      if (roleRows.length === 0) throw new Error('角色不存在')

      const orgTable = await this.resolveOrgTableName()

      // 过滤不存在的 orgId（仅校验 id 是否存在）
      const placeholders = orgIds.map(() => '?').join(',')
      const [orgRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM \`${orgTable}\` WHERE id IN (${placeholders})`,
        orgIds
      )
      const existingOrgIds = new Set((orgRows as any[]).map(r => Number(r.id)))
      const validOrgIds = orgIds.filter(id => existingOrgIds.has(Number(id)))
      if (validOrgIds.length === 0) throw new Error('没有可添加的机构')

      // 已存在的关联
      const [existsRows] = await conn.execute<RowDataPacket[]>(
        `SELECT org_id FROM role_orgs WHERE role_id = ? AND org_id IN (${validOrgIds.map(() => '?').join(',')})`,
        [roleId, ...validOrgIds]
      )
      const existed = new Set((existsRows as any[]).map(r => Number(r.org_id)))
      const toInsert = validOrgIds.filter(id => !existed.has(Number(id)))
      if (toInsert.length === 0) {
        await conn.commit()
        return 0
      }

      await conn.execute(
        `INSERT INTO role_orgs (role_id, org_id) VALUES ${toInsert.map(() => '(?, ?)').join(', ')}`,
        toInsert.flatMap(oid => [roleId, oid])
      )

      await conn.commit()
      return toInsert.length
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  /** 从角色移除单个机构 */
  static async removeOrgFromRole(roleId: number, orgId: number): Promise<void> {
    const [r] = await pool.execute<RowDataPacket[]>('SELECT id FROM roles WHERE id = ?', [roleId])
    if (r.length === 0) throw new Error('角色不存在')

    const orgTable = await this.resolveOrgTableName()
    const [o] = await pool.execute<RowDataPacket[]>(`SELECT id FROM \`${orgTable}\` WHERE id = ?`, [orgId])
    if (o.length === 0) throw new Error('机构不存在')

    const [ret] = await pool.execute<ResultSetHeader>('DELETE FROM role_orgs WHERE role_id = ? AND org_id = ?', [
      roleId,
      orgId,
    ])
    if (ret.affectedRows === 0) throw new Error('该角色未关联该机构')
  }
}
