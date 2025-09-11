// apps/backend/src/modules/roles/repositories/role.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Role } from '../domain/role.model.js'

export class RoleRepository {
  // ===== 角色 ⇄ 机构 =====
  private static __ORG_TABLE_CACHE: string | null = null
  private static __ORG_NAME_COL_CACHE: string | null = null
  static async findAll(order = 'ORDER BY is_system DESC, created_at ASC'): Promise<Role[]> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM roles ${order}`)
    return rows as unknown as Role[]
  }

  static async findPage(
    whereSql: string,
    params: any[],
    limit: number,
    offset: number,
    order = 'ORDER BY is_system DESC, created_at ASC'
  ): Promise<{ rows: Role[]; total: number }> {
    const [[cnt]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM roles ${whereSql}`, params)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM roles ${whereSql} ${order} LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    )
    return { rows: rows as unknown as Role[], total: Number((cnt as any)?.total || 0) }
  }

  static async findById(id: number): Promise<Role | null> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM roles WHERE id = ? LIMIT 1`, [id])
    return rows.length ? (rows[0] as unknown as Role) : null
  }

  static async findByName(name: string): Promise<Role | null> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM roles WHERE name = ? LIMIT 1`, [name])
    return rows.length ? (rows[0] as unknown as Role) : null
  }

  static async codeExists(code: string, excludeId?: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      excludeId
        ? `SELECT id FROM roles WHERE LOWER(code) = LOWER(?) AND id <> ? LIMIT 1`
        : `SELECT id FROM roles WHERE LOWER(code) = LOWER(?) LIMIT 1`,
      excludeId ? [code, excludeId] : [code]
    )
    return rows.length > 0
  }

  static async insert(payload: {
    name: string
    code: string
    description?: string | null
    sort_order: number
    is_disabled: 0 | 1
  }): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>(
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
    const [ret] = await pool.query<ResultSetHeader>(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, vals)
    return ret.affectedRows > 0
  }

  static async remove(id: number): Promise<boolean> {
    const [ret] = await pool.query<ResultSetHeader>(`DELETE FROM roles WHERE id = ?`, [id])
    return ret.affectedRows > 0
  }

  // ===== role_menus / user_roles / role_orgs =====
  static async listRoleMenus(roleId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.* FROM role_menus rm JOIN menus m ON rm.menu_id = m.id
       WHERE rm.role_id = ? ORDER BY m.sort_order, m.id`,
      [roleId]
    )
    return rows
  }

  static async setRoleMenus(roleId: number, menuIds: number[]): Promise<void> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(`DELETE FROM role_menus WHERE role_id = ?`, [roleId])
      if (menuIds.length) {
        await conn.query(
          `INSERT INTO role_menus (role_id, menu_id) VALUES ${menuIds.map(() => '(?, ?)').join(', ')}`,
          menuIds.flatMap(id => [roleId, id])
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

  static async listUserRoles(userId: number): Promise<Role[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.* FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?
       ORDER BY r.is_system DESC, r.created_at ASC`,
      [userId]
    )
    return rows as unknown as Role[]
  }

  static async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId])
      if (roleIds.length) {
        await conn.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ${roleIds.map(() => '(?, ?)').join(', ')}`,
          roleIds.flatMap(id => [userId, id])
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

  static async listRoleUsers(roleId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, ur.assigned_at
       FROM users u JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role_id = ?
       ORDER BY ur.assigned_at DESC`,
      [roleId]
    )
    return rows
  }

  static async isRoleUsedByUsers(roleId: number): Promise<boolean> {
    const [[r]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM user_roles WHERE role_id = ?`, [
      roleId,
    ])
    return Number((r as any)?.cnt || 0) > 0
  }

  // ===== 角色 ⇄ 机构 =====
  private static __ORG_TABLE_CACHE: string | null = null
  private static __ORG_NAME_COL_CACHE: string | null = null

  /** 解析机构表名（优先 ORG_TABLE，否则自动探测） */
  private static async resolveOrgTable(): Promise<string> {
    if (this.__ORG_TABLE_CACHE) return this.__ORG_TABLE_CACHE
    const env = (process.env.ORG_TABLE || '').trim()
    if (env) {
      this.__ORG_TABLE_CACHE = env
      return env
    }
    const candidates = ['organizations', 'orgs', 'organization', 'dept', 'depts', 'departments', 'sys_org', 'sys_orgs']
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN (${candidates.map(() => '?').join(',')})
       LIMIT 1`,
      candidates
    )
    if (!rows.length) throw new Error('未找到机构表，请设置 ORG_TABLE')
    this.__ORG_TABLE_CACHE = String(rows[0].table_name)
    return this.__ORG_TABLE_CACHE
  }

  /** 解析机构名称列（优先 ORG_NAME_COL，否则从候选里挑存在的一个） */
  private static async resolveOrgNameCol(table: string): Promise<string | null> {
    if (this.__ORG_NAME_COL_CACHE) return this.__ORG_NAME_COL_CACHE

    // ✅ 允许通过环境变量明确指定列名（如 name / org_name / title）
    const envName = (process.env.ORG_NAME_COL || '').trim()
    if (envName) {
      this.__ORG_NAME_COL_CACHE = envName
      return this.__ORG_NAME_COL_CACHE
    }

    const prefer = ['name', 'title', 'org_name', 'label', 'orgTitle', 'orgLabel']
    const [cols] = await pool.query<RowDataPacket[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    )
    const set = new Set((cols as any[]).map(c => String(c.column_name)))
    this.__ORG_NAME_COL_CACHE = prefer.find(c => set.has(c)) || null
    return this.__ORG_NAME_COL_CACHE
  }

  /** 返回角色关联的机构（联表 organizations，把名称一并返回） */
  static async roleOrgs(roleId: number): Promise<Array<{ id: number; name?: string }>> {
    const orgTable = await this.resolveOrgTable() // e.g. organizations
    const nameCol = await this.resolveOrgNameCol(orgTable) // e.g. name

    let sql = `SELECT o.id`
    if (nameCol) sql += `, o.\`${nameCol}\` AS name`
    sql += `
      FROM role_orgs ro
      JOIN \`${orgTable}\` o ON o.id = ro.org_id
      WHERE ro.role_id = ?
      ORDER BY o.id
    `
    const [rows] = await pool.query<RowDataPacket[]>(sql, [roleId])
    return rows as any
  }

  /** 批量新增关联，先校验 org 存在再去重插入 */
  static async addRoleOrgs(roleId: number, orgIds: number[]): Promise<number> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const orgTable = await this.resolveOrgTable()

      if (!orgIds?.length) {
        await conn.commit()
        return 0
      }

      // 只保留 organizations 中真实存在的 id
      const [existOrgRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM \`${orgTable}\` WHERE id IN (${orgIds.map(() => '?').join(',')})`,
        orgIds
      )
      const exist = new Set((existOrgRows as any[]).map(r => Number(r.id)))
      const valid = orgIds.filter(id => exist.has(Number(id)))
      if (!valid.length) {
        await conn.commit()
        return 0
      }

      // 去重：排除已有关联
      const [existedLinks] = await conn.query<RowDataPacket[]>(
        `SELECT org_id FROM role_orgs WHERE role_id = ? AND org_id IN (${valid.map(() => '?').join(',')})`,
        [roleId, ...valid]
      )
      const existed = new Set((existedLinks as any[]).map(r => Number(r.org_id)))
      const toInsert = valid.filter(id => !existed.has(Number(id)))
      if (!toInsert.length) {
        await conn.commit()
        return 0
      }

      await conn.query(
        `INSERT INTO role_orgs (role_id, org_id) VALUES ${toInsert.map(() => '(?, ?)').join(',')}`,
        toInsert.flatMap(id => [roleId, id])
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

  /** 解除关联 */
  static async removeRoleOrg(roleId: number, orgId: number): Promise<void> {
    const [ret] = await pool.query<ResultSetHeader>(`DELETE FROM role_orgs WHERE role_id = ? AND org_id = ?`, [
      roleId,
      orgId,
    ])
    if (!ret.affectedRows) throw new Error('该角色未关联该机构')
  }
}
