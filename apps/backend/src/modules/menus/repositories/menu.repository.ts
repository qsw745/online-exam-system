// apps/backend/src/modules/menus/repositories/menu.repository.ts
import { pool } from '@/config/database'
import type {
  CreateMenuRequest,
  CreateRoleRequest,
  Menu,
  Role,
  UpdateMenuRequest,
  UpdateRoleRequest,
} from '../domain/menu.model'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

// ---- 关键：最小可查询接口（含事务连接）避免与外部 Pool/PoolConnection 类型冲突 ----
type QueryableConnection = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}
type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
  getConnection?: () => Promise<QueryableConnection>
}
const db: Queryable = pool as unknown as Queryable

type TablePresence = 'unknown' | 'present' | 'missing'
let unitMenusTableState: TablePresence = 'unknown'

export type MenuUpdate = { id: number; parent_id?: number | null; sort_order?: number }

export class MenuRepository {
  private static async canUseUnitMenus(): Promise<boolean> {
    if (unitMenusTableState === 'present') return true
    if (unitMenusTableState === 'missing') return false
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_menus' LIMIT 1`
      )
      unitMenusTableState = rows.length ? 'present' : 'missing'
    } catch {
      unitMenusTableState = 'missing'
    }
    return unitMenusTableState === 'present'
  }

  private static markUnitMenusMissing() {
    unitMenusTableState = 'missing'
  }

  // menu.repository.ts 内增补
  static async findMenusByFilter(filter: { is_system?: 0 | 1; unit_id?: number }): Promise<Menu[]> {
    const where: string[] = []
    const vals: any[] = []
    if (filter.is_system !== undefined) {
      where.push('is_system=?')
      vals.push(filter.is_system)
    }
    if (filter.unit_id !== undefined) {
      where.push('unit_id=?')
      vals.push(filter.unit_id)
    }
    const sql =
      'SELECT * FROM menus' + (where.length ? ` WHERE ${where.join(' AND ')}` : '') + ' ORDER BY sort_order ASC, id ASC'
    const [rows] = await db.query<RowDataPacket[]>(sql, vals)
    return rows as unknown as Menu[]
  }

  static async menuExistsAndEnabled(menuId: number): Promise<boolean> {
    const [[row]] = await db.query<RowDataPacket[]>('SELECT 1 FROM menus WHERE id=? AND is_disabled=0 LIMIT 1', [
      menuId,
    ])
    return !!row
  }

  // --- menus ---
  static async findAllMenus(): Promise<Menu[]> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM menus ORDER BY sort_order ASC, id ASC')
    return rows as unknown as Menu[]
  }

  static async findMenuById(id: number): Promise<Menu | null> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM menus WHERE id=?', [id])
    return rows.length ? (rows[0] as unknown as Menu) : null
  }

  static async insertMenu(data: CreateMenuRequest & { level: number; is_system: boolean }): Promise<number> {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO menus (
        name, title, path, component, icon, parent_id, sort_order, level,
        is_hidden, is_disabled, is_system, menu_type, permission_code,
        redirect, meta, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.title,
        data.path ?? null,
        data.component ?? null,
        data.icon ?? null,
        data.parent_id ?? null,
        data.sort_order ?? 0,
        data.level,
        !!data.is_hidden,
        !!data.is_disabled,
        !!data.is_system,
        data.menu_type ?? 'menu',
        data.permission_code ?? null,
        data.redirect ?? null,
        data.meta ?? null,
        data.description ?? null,
      ]
    )
    return res.insertId
  }

  static async updateMenu(data: UpdateMenuRequest): Promise<boolean> {
    const { id, ...rest } = data
    const fields: string[] = []
    const values: any[] = []
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) {
        fields.push(`${k}=?`)
        values.push(v ?? null)
      }
    }
    if (!fields.length) return false
    values.push(id)
    const [res] = await db.query<ResultSetHeader>(`UPDATE menus SET ${fields.join(', ')} WHERE id=?`, values)
    return res.affectedRows > 0
  }

  static async deleteMenu(id: number): Promise<boolean> {
    const [res] = await db.query<ResultSetHeader>('DELETE FROM menus WHERE id=?', [id])
    return res.affectedRows > 0
  }

  static async countChildren(menuId: number): Promise<number> {
    const [[row]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM menus WHERE parent_id=?', [menuId])
    return Number((row as any)?.cnt || 0)
  }

  // 批量更新排序/父级（事务）
  static async batchUpdateSort(updates: MenuUpdate[]): Promise<void> {
    if (!db.getConnection) throw new Error('DB 连接池不支持 getConnection')
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      for (const u of updates) {
        const sets: string[] = []
        const vals: any[] = []
        if (u.parent_id !== undefined) {
          sets.push('parent_id=?')
          vals.push(u.parent_id)
        }
        if (u.sort_order !== undefined) {
          sets.push('sort_order=?')
          vals.push(u.sort_order)
        }
        if (!sets.length) continue
        vals.push(u.id)
        await conn.query(`UPDATE menus SET ${sets.join(', ')} WHERE id=?`, vals)
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // --- roles ---
  static async findAllRoles(): Promise<Role[]> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM roles ORDER BY sort_order ASC, id ASC')
    return rows as unknown as Role[]
  }

  static async findRoleById(id: number): Promise<Role | null> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM roles WHERE id=?', [id])
    return rows.length ? (rows[0] as unknown as Role) : null
  }

  static async insertRole(data: CreateRoleRequest & { sort_order: number; is_system: boolean; is_disabled: boolean }) {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO roles (name, code, description, sort_order, is_system, is_disabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, data.code, data.description ?? null, data.sort_order, !!data.is_system, !!data.is_disabled]
    )
    return res.insertId
  }

  static async maxRoleSort(): Promise<number> {
    const [[row]] = await db.query<RowDataPacket[]>('SELECT COALESCE(MAX(sort_order),0) AS max_sort FROM roles')
    return Number((row as any)?.max_sort || 0)
  }

  static async updateRole(data: UpdateRoleRequest): Promise<boolean> {
    const { id, ...rest } = data
    const fields: string[] = []
    const values: any[] = []
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) {
        fields.push(`${k}=?`)
        values.push(v ?? null)
      }
    }
    if (!fields.length) return false
    values.push(id)
    const [res] = await db.query<ResultSetHeader>(`UPDATE roles SET ${fields.join(', ')} WHERE id=?`, values)
    return res.affectedRows > 0
  }

  static async deleteRole(id: number): Promise<boolean> {
    const [res] = await db.query<ResultSetHeader>('DELETE FROM roles WHERE id=?', [id])
    return res.affectedRows > 0
  }

  static async anyUserUsingRole(roleId: number): Promise<boolean> {
    const [[row]] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM user_org_roles WHERE role_id=?', [
      roleId,
    ])
    return Number((row as any)?.cnt || 0) > 0
  }

  // role_menus
  static async replaceRoleMenus(roleId: number, menuIds: number[], conn?: QueryableConnection): Promise<void> {
    const cx =
      conn ??
      (await (async () => {
        if (!db.getConnection) throw new Error('DB 连接池不支持 getConnection')
        return db.getConnection!()
      })())
    let created = false
    try {
      if (!conn) {
        created = true
        await cx.beginTransaction()
      }
      await cx.query('DELETE FROM role_menus WHERE role_id=?', [roleId])
      if (menuIds.length) {
        const placeholders = menuIds.map(() => '(?,?)').join(', ')
        const vals = menuIds.flatMap(m => [roleId, m])
        await cx.query(`INSERT INTO role_menus (role_id, menu_id) VALUES ${placeholders}`, vals)
      }
      if (created) await cx.commit()
    } catch (e) {
      if (created) await cx.rollback()
      throw e
    } finally {
      if (!conn) cx.release()
    }
  }

  static async getRoleMenuIds(roleId: number): Promise<number[]> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT menu_id FROM role_menus WHERE role_id=?', [roleId])
    return (rows as any[]).map(r => r.menu_id as number)
  }

  // user_org_roles
  static async replaceUserRolesInOrg(userId: number, orgId: number, roleIds: number[]): Promise<void> {
    if (!db.getConnection) throw new Error('DB 连接池不支持 getConnection')
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('DELETE FROM user_org_roles WHERE user_id=? AND org_id=?', [userId, orgId])
      if (roleIds.length) {
        const placeholders = roleIds.map(() => '(?,?,?,NOW())').join(', ')
        const values = roleIds.flatMap(id => [userId, orgId, id])
        await conn.query(
          `INSERT INTO user_org_roles (user_id, org_id, role_id, assigned_at) VALUES ${placeholders}`,
          values
        )
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  static async findUserRolesInOrg(userId: number, orgId: number): Promise<Role[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT r.* FROM user_org_roles uor
       JOIN roles r ON r.id=uor.role_id
       WHERE uor.user_id=? AND uor.org_id=? AND r.is_disabled=0
       ORDER BY r.sort_order ASC, r.id ASC`,
      [userId, orgId]
    )
    return rows as unknown as Role[]
  }

  static async getPrimaryOrgId(userId: number): Promise<number | null> {
    const [[row]] = await db.query<RowDataPacket[]>(
      `SELECT org_id FROM user_organizations WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
      [userId]
    )
    if ((row as any)?.org_id) return Number((row as any).org_id)
    const [[roleOrg]] = await db.query<RowDataPacket[]>(
      `SELECT org_id FROM user_org_roles WHERE user_id=? ORDER BY org_id LIMIT 1`,
      [userId]
    )
    return (roleOrg as any)?.org_id ? Number((roleOrg as any).org_id) : null
  }

  static async findAnyOrgId(): Promise<number | null> {
    const [[row]] = await db.query<RowDataPacket[]>(`SELECT id FROM organizations ORDER BY id LIMIT 1`)
    return (row as any)?.id ?? null
  }

  static async isUserAdminInOrg(userId: number, orgId: number): Promise<boolean> {
    const [[row]] = await db.query<RowDataPacket[]>(
      `
    SELECT 1 FROM (
      -- 仅限：该用户在该机构直接授予的角色
      SELECT r.code, r.is_disabled
        FROM user_org_roles uor
        JOIN roles r ON r.id = uor.role_id
       WHERE uor.user_id = ? AND uor.org_id = ?
      UNION ALL
      -- 以及用户的全局/本机构角色
      SELECT r2.code, r2.is_disabled
        FROM user_roles ur
        JOIN roles r2 ON r2.id = ur.role_id
       WHERE ur.user_id = ? AND (r2.org_id IS NULL OR r2.org_id = ?)
    ) t
    WHERE t.is_disabled = 0 AND LOWER(t.code) IN ('admin','super_admin','superadmin')
    LIMIT 1
    `,
      [userId, orgId, userId, orgId]
    )
    return !!row
  }

  // user_menus (个性化授权)
  static async upsertUserMenuPermission(
    userId: number,
    menuId: number,
    permissionType: 'grant' | 'deny'
  ): Promise<boolean> {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO user_menus (user_id, menu_id, permission_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE permission_type=VALUES(permission_type)`,
      [userId, menuId, permissionType]
    )
    return res.affectedRows > 0
  }

  static async deleteUserMenuPermission(userId: number, menuId: number): Promise<boolean> {
    const [res] = await db.query<ResultSetHeader>('DELETE FROM user_menus WHERE user_id=? AND menu_id=?', [
      userId,
      menuId,
    ])
    return res.affectedRows > 0
  }

  static async queryUserMenuPermissionRows(userId: number, orgId: number): Promise<RowDataPacket[]> {
    const canUseUnit = await this.canUseUnitMenus()

    const runQuery = async (useUnit: boolean) => {
      const baseCte = `
        WITH role_ids AS (
          SELECT uor.role_id
            FROM user_org_roles uor
           WHERE uor.user_id = ? AND uor.org_id = ?
          UNION
          SELECT ur.role_id
            FROM user_roles ur
           WHERE ur.user_id = ?
             AND (
               NOT EXISTS (SELECT 1 FROM role_orgs rox WHERE rox.role_id = ur.role_id)
               OR EXISTS (SELECT 1 FROM role_orgs rox WHERE rox.role_id = ur.role_id AND rox.org_id = ?)
             )
          UNION
          SELECT ro.role_id
            FROM role_orgs ro
           WHERE ro.org_id = ?
        ),
        role_menu_union AS (
          SELECT DISTINCT rm.menu_id
            FROM role_menus rm
            JOIN role_ids ri ON ri.role_id = rm.role_id
        )
      `

      const selectWithUnit = `
        ${baseCte}
        SELECT
          m.id AS menu_id,
          COALESCE(um.name, m.name)                         AS menu_name,
          COALESCE(um.title, m.title)                       AS menu_title,
          COALESCE(um.path, m.path)                         AS path,
          COALESCE(um.component, m.component)               AS component,
          COALESCE(um.icon, m.icon)                         AS icon,
          COALESCE(um.parent_sys_id, m.parent_id)           AS parent_id,
          COALESCE(um.sort_order, m.sort_order)             AS sort_order,
          m.level                                           AS level,
          COALESCE(um.menu_type, m.menu_type)               AS menu_type,
          COALESCE(um.permission_code, m.permission_code)   AS permission_code,
          COALESCE(um.redirect, m.redirect)                 AS redirect,
          COALESCE(um.meta, m.meta)                         AS meta,
          CASE
            WHEN uum.permission_type='deny'  THEN FALSE
            WHEN uum.permission_type='grant' THEN TRUE
            WHEN rmu.menu_id IS NOT NULL     THEN TRUE
            ELSE FALSE
          END AS has_permission,
          CASE
            WHEN uum.permission_type='deny'  THEN 'deny'
            WHEN uum.permission_type='grant' THEN 'user'
            WHEN rmu.menu_id IS NOT NULL     THEN 'role'
            ELSE 'none'
          END AS permission_source
        FROM menus m
        LEFT JOIN unit_menus um
               ON um.sys_menu_id = m.id AND um.unit_id = ?
        LEFT JOIN user_menus uum
               ON uum.menu_id = m.id AND uum.user_id = ?
        LEFT JOIN role_menu_union rmu
               ON rmu.menu_id = m.id
        WHERE COALESCE(um.is_disabled, m.is_disabled) = 0
          AND COALESCE(um.menu_type, m.menu_type) IN ('menu','link','page')
        ORDER BY COALESCE(um.sort_order, m.sort_order), m.id
      `

      const selectWithoutUnit = `
        ${baseCte}
        SELECT
          m.id AS menu_id,
          m.name AS menu_name,
          m.title AS menu_title,
          m.path AS path,
          m.component AS component,
          m.icon AS icon,
          m.parent_id AS parent_id,
          m.sort_order AS sort_order,
          m.level AS level,
          m.menu_type AS menu_type,
          m.permission_code AS permission_code,
          m.redirect AS redirect,
          m.meta AS meta,
          CASE
            WHEN uum.permission_type='deny'  THEN FALSE
            WHEN uum.permission_type='grant' THEN TRUE
            WHEN rmu.menu_id IS NOT NULL     THEN TRUE
            ELSE FALSE
          END AS has_permission,
          CASE
            WHEN uum.permission_type='deny'  THEN 'deny'
            WHEN uum.permission_type='grant' THEN 'user'
            WHEN rmu.menu_id IS NOT NULL     THEN 'role'
            ELSE 'none'
          END AS permission_source
        FROM menus m
        LEFT JOIN user_menus uum
               ON uum.menu_id = m.id AND uum.user_id = ?
        LEFT JOIN role_menu_union rmu
               ON rmu.menu_id = m.id
        WHERE m.is_disabled = 0
          AND m.menu_type IN ('menu','link','page')
        ORDER BY m.sort_order, m.id
      `

      const params: any[] = [userId, orgId, userId, orgId, orgId]

      if (useUnit) {
        const paramsWithUnit = [...params, orgId, userId]
        const [rows] = await db.query<RowDataPacket[]>(selectWithUnit, paramsWithUnit)
        return rows
      }

      const paramsWithoutUnit = [...params, userId]
      const [rows] = await db.query<RowDataPacket[]>(selectWithoutUnit, paramsWithoutUnit)
      return rows
    }

    try {
      return await runQuery(canUseUnit)
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE' && canUseUnit) {
        this.markUnitMenusMissing()
        return runQuery(false)
      }
      throw err
    }
  }

  static async checkUserMenuPermissionInOrg(userId: number, orgId: number, menuId: number): Promise<boolean> {
    const runCheck = async () => {
      const params: any[] = [userId, orgId, userId, orgId, orgId, userId, menuId]

      const sql = `
        SELECT
          CASE
            WHEN um.permission_type='deny'  THEN 0
            WHEN um.permission_type='grant' THEN 1
            WHEN EXISTS (
              SELECT 1
                FROM role_menus rm
                WHERE rm.menu_id = m.id
                  AND rm.role_id IN (
                    SELECT uor.role_id FROM user_org_roles uor WHERE uor.user_id=? AND uor.org_id=?
                    UNION
                    SELECT ur.role_id FROM user_roles ur
                     WHERE ur.user_id=?
                       AND (
                         NOT EXISTS (SELECT 1 FROM role_orgs rox WHERE rox.role_id = ur.role_id)
                         OR EXISTS (SELECT 1 FROM role_orgs rox WHERE rox.role_id = ur.role_id AND rox.org_id = ?)
                       )
                    UNION
                    SELECT ro.role_id FROM role_orgs ro WHERE ro.org_id=?
                  )
            ) THEN 1
            ELSE 0
          END AS has_permission
        FROM menus m
        LEFT JOIN user_menus um ON um.menu_id=m.id AND um.user_id=?
        WHERE m.id=? AND m.is_disabled=0
        LIMIT 1
      `

      const [[row]] = await db.query<RowDataPacket[]>(sql, params)
      return row as any
    }

    const row = await runCheck()
    return !!row?.has_permission
  }
}
