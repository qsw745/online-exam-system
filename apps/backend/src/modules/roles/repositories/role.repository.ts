/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool as basePool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Role } from '../domain/role.model.js'

interface DBConn {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}
interface DBPool {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
  getConnection(): Promise<DBConn>
}
const pool = basePool as unknown as DBPool

export class RoleRepository {
  // ===== roles =====
  static async findAll(order = 'ORDER BY is_system DESC, created_at ASC'): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM roles ${order}`)
    return rows as unknown as Role[]
  }

  /** 仅按关键字做全局过滤；如需按机构过滤，可传 orgId 使用 role_orgs 连接 */
  static async findPageWithOrg(
    orgId: number | null | undefined,
    keyword: string | undefined,
    limit: number,
    offset: number
  ): Promise<{ rows: Role[]; total: number }> {
    const where: string[] = []
    const joins: string[] = []
    const params: any[] = []

    if (typeof orgId !== 'undefined') {
      joins.push('JOIN role_orgs ro ON ro.role_id = r.id')
      where.push('ro.org_id = ?')
      params.push(orgId)
    }
    if (keyword && keyword.trim()) {
      const s = `%${keyword.trim()}%`
      where.push('(r.name LIKE ? OR r.description LIKE ? OR r.code LIKE ?)')
      params.push(s, s, s)
    }

    const joinSql = joins.length ? joins.join(' ') : ''
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [[cnt]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT r.id) AS total FROM roles r ${joinSql} ${whereSql}`,
      params
    )
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT r.* FROM roles r ${joinSql} ${whereSql}
       ORDER BY r.is_system DESC, r.created_at ASC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    )
    return { rows: rows as any, total: Number((cnt as any)?.total || 0) }
  }

  static async findById(id: number): Promise<Role | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM roles WHERE id = ? LIMIT 1`, [id])
    return (rows as any[]).length ? (rows[0] as unknown as Role) : null
  }

  // ===== 写入/更新/删除 =====
  static async insert(payload: {
    name: string
    code: string
    description?: string | null
    sort_order: number
    is_disabled: 0 | 1
  }): Promise<number> {
    const [ret] = await pool.execute<ResultSetHeader>(
      `INSERT INTO roles (name, code, description, sort_order, is_disabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [payload.name, payload.code, payload.description ?? null, payload.sort_order, payload.is_disabled]
    )
    return ret.insertId
  }

  static async update(id: number, partial: Partial<Role>): Promise<boolean> {
    const sets: string[] = []
    const vals: any[] = []
    if (partial.name !== undefined) {
      sets.push('name = ?')
      vals.push(partial.name)
    }
    if (partial.code !== undefined) {
      sets.push('code = ?')
      vals.push(partial.code)
    }
    if (partial.description !== undefined) {
      sets.push('description = ?')
      vals.push(partial.description ?? null)
    }
    if (partial.is_disabled !== undefined) {
      sets.push('is_disabled = ?')
      vals.push(partial.is_disabled ? 1 : 0)
    }
    if (partial.sort_order !== undefined) {
      sets.push('sort_order = ?')
      vals.push(Number(partial.sort_order) || 1)
    }
    if (!sets.length) return true
    sets.push('updated_at = NOW()')
    vals.push(id)
    const [ret] = await pool.execute<ResultSetHeader>(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, vals)
    return ret.affectedRows > 0
  }

  static async remove(id: number): Promise<boolean> {
    const [ret] = await pool.execute<ResultSetHeader>(`DELETE FROM roles WHERE id = ?`, [id])
    return ret.affectedRows > 0
  }

  static async isRoleUsedByUsers(roleId: number): Promise<boolean> {
    const [[r]] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM user_roles WHERE role_id = ?`, [
      roleId,
    ])
    return Number((r as any)?.cnt || 0) > 0
  }

  // ===== 角色 ⇄ 用户（补上 add/remove，修正你 Controller 的 2339 报错）=====
  static async addUsersToRole(roleId: number, userIds: number[]): Promise<number> {
    if (!userIds.length) return 0
    const sql = `INSERT IGNORE INTO user_roles (user_id, role_id, assigned_at)
                 VALUES ${userIds.map(() => '(?, ?, NOW())').join(', ')}`
    const params = userIds.flatMap(uid => [uid, roleId])
    const [ret] = await pool.execute<ResultSetHeader>(sql, params)
    return ret.affectedRows
  }

  static async removeUserFromRole(roleId: number, userId: number): Promise<void> {
    await pool.execute(`DELETE FROM user_roles WHERE role_id = ? AND user_id = ?`, [roleId, userId])
  }

  // ===== 角色 ⇄ 机构（可选多对多）=====
  static async roleOrgs(roleId: number): Promise<Array<{ id: number; name: string }>> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT o.id, o.name
         FROM role_orgs ro JOIN organizations o ON o.id = ro.org_id
        WHERE ro.role_id = ?
        ORDER BY o.id`,
      [roleId]
    )
    return (rows as any[]).map(r => ({ id: Number(r.id), name: String(r.name) }))
  }

  static async addRoleOrgs(roleId: number, orgIds: number[]): Promise<number> {
    if (!orgIds.length) return 0
    const sql = `INSERT IGNORE INTO role_orgs (role_id, org_id, created_at)
                 VALUES ${orgIds.map(() => '(?, ?, NOW())').join(', ')}`
    const params = orgIds.flatMap(oid => [roleId, oid])
    const [ret] = await pool.execute<ResultSetHeader>(sql, params)
    return ret.affectedRows
  }

  static async removeRoleOrg(roleId: number, orgId: number): Promise<void> {
    await pool.execute(`DELETE FROM role_orgs WHERE role_id = ? AND org_id = ?`, [roleId, orgId])
  }

  static async listRolesByOrg(orgId: number): Promise<Role[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.* FROM role_orgs ro JOIN roles r ON r.id = ro.role_id
        WHERE ro.org_id = ?
        ORDER BY r.sort_order, r.id`,
      [orgId]
    )
    return rows as any
  }

  // ===== 角色权限（role_permissions）=====
  static async listPermissionCodes(roleId: number): Promise<string[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rp.permission_code FROM role_permissions rp WHERE rp.role_id = ? ORDER BY rp.permission_code`,
      [roleId]
    )
    return (rows as any[]).map(r => String(r.permission_code))
  }

  static async permissionCodesFromMenuIds(menuIds: number[]): Promise<string[]> {
    if (!menuIds.length) return []
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT permission_code
         FROM menus WHERE id IN (${menuIds.map(() => '?').join(',')})
           AND permission_code IS NOT NULL AND permission_code <> ''`,
      menuIds
    )
    return (rows as any[]).map(r => String(r.permission_code))
  }

  static async setPermissionCodes(roleId: number, codes: string[]): Promise<void> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId])
      if (codes.length) {
        await conn.execute(
          `INSERT IGNORE INTO permissions (code, description, created_at, updated_at)
           VALUES ${codes.map(() => '(?, ?, NOW(), NOW())').join(', ')}`,
          codes.flatMap(c => [c, 'from menu assignment'])
        )
        await conn.execute(
          `INSERT IGNORE INTO role_permissions (role_id, permission_code)
           VALUES ${codes.map(() => '(?, ?)').join(', ')}`,
          codes.flatMap(c => [roleId, c])
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

  static async menusByPermissionCodes(codes: string[]): Promise<RowDataPacket[]> {
    if (!codes.length) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM menus WHERE permission_code IS NULL OR permission_code = '' ORDER BY sort_order, id`
      )
      return rows
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM menus
         WHERE permission_code IS NULL OR permission_code = '' OR permission_code IN (${codes.map(() => '?').join(',')})
       ORDER BY sort_order, id`,
      codes
    )
    return rows
  }

  /** ✅ 全量菜单（未禁用），用于“授权弹窗显示全部” */
  static async findAllMenus(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, title, parent_id, sort_order
         FROM menus
        WHERE is_disabled = 0
        ORDER BY sort_order, id`
    )
    // 兼容前端结构：title / name / parent_id
    return rows as any
  }
  /** ✅ 由权限码反推被选中的菜单ID（只统计有 permission_code 的菜单） */
  static async menuIdsFromPermissionCodes(codes: string[]): Promise<number[]> {
    if (!codes?.length) return []
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM menus WHERE permission_code IN (${codes.map(() => '?').join(',')})`,
      codes
    )
    return (rows as any[]).map(r => Number(r.id)).filter(Number.isFinite)
  }
}
