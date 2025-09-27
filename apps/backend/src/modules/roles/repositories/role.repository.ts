import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Role } from '../domain/role.model.js'

export class RoleRepository {
    // ===== roles =====
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

    static async nameExists(name: string, orgId: number | null, excludeId?: number): Promise<boolean> {
        const sql =
            excludeId != null
                ? `SELECT id FROM roles WHERE org_id <=> ? AND LOWER(name)=LOWER(?) AND id <> ? LIMIT 1`
                : `SELECT id FROM roles WHERE org_id <=> ? AND LOWER(name)=LOWER(?) LIMIT 1`
        const [rows] = await pool.query<RowDataPacket[]>(sql, excludeId != null ? [orgId, name, excludeId] : [orgId, name])
        return rows.length > 0
    }

    static async codeExists(code: string, orgId: number | null, excludeId?: number): Promise<boolean> {
        const sql =
            excludeId != null
                ? `SELECT id FROM roles WHERE org_id <=> ? AND LOWER(code)=LOWER(?) AND id <> ? LIMIT 1`
                : `SELECT id FROM roles WHERE org_id <=> ? AND LOWER(code)=LOWER(?) LIMIT 1`
        const [rows] = await pool.query<RowDataPacket[]>(
            sql,
            excludeId != null ? [orgId, code, excludeId] : [orgId, code]
        )
        return rows.length > 0
    }

    static async insert(payload: {
        org_id: number | null
        name: string
        code: string
        description?: string | null
        sort_order: number
        is_disabled: 0 | 1
    }): Promise<number> {
        const [ret] = await pool.query<ResultSetHeader>(
            `INSERT INTO roles (org_id, name, code, description, sort_order, is_disabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [payload.org_id, payload.name, payload.code, payload.description ?? null, payload.sort_order, payload.is_disabled]
        )
        return ret.insertId
    }

    static async update(id: number, partial: Partial<Role>): Promise<boolean> {
        const sets: string[] = []
        const vals: any[] = []

        if (partial.org_id !== undefined) {
            sets.push('org_id = ?')
            vals.push(partial.org_id)
        }
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

    // ===== role_menus / user_roles =====
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
        const [[r]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM user_roles WHERE role_id = ?`, [roleId])
        return Number((r as any)?.cnt || 0) > 0
    }

    /** 新增：往角色添加若干用户（忽略已存在的重复关系） */
    static async addUsersToRole(roleId: number, userIds: number[]): Promise<number> {
        if (!userIds.length) return 0
        const sql = `INSERT IGNORE INTO user_roles (user_id, role_id, assigned_at) VALUES ${userIds
            .map(() => '(?, ?, NOW())')
            .join(', ')}`
        const params = userIds.flatMap(uid => [uid, roleId])
        const [ret] = await pool.query<ResultSetHeader>(sql, params)
        return ret.affectedRows
    }

    /** 新增：从角色移除单个用户 */
    static async removeUserFromRole(roleId: number, userId: number): Promise<void> {
        await pool.query(`DELETE FROM user_roles WHERE role_id = ? AND user_id = ?`, [roleId, userId])
    }

    // ===== 角色 ⇄ 机构（单机构：来自 roles.org_id） =====
    static async roleOrgs(roleId: number): Promise<Array<{ id: number; name?: string }>> {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT o.id, o.name
             FROM roles r
                      LEFT JOIN organizations o ON o.id = r.org_id
             WHERE r.id = ? AND r.org_id IS NOT NULL
                 LIMIT 1`,
            [roleId]
        )
        if (!rows.length) return []
        return [{ id: Number(rows[0].id), name: (rows[0].name as string) || undefined }]
    }

    /** 单机构：把 org_id 设为 targetOrgId；返回 1 表示已变更，0 表示无需变更 */
    static async addRoleOrgs(roleId: number, targetOrgId: number): Promise<number> {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT org_id FROM roles WHERE id = ? LIMIT 1`, [roleId])
        if (!rows.length) throw new Error('角色不存在')
        const cur = rows[0].org_id == null ? null : Number(rows[0].org_id)
        if (cur === targetOrgId) return 0
        const [ret] = await pool.query<ResultSetHeader>(
            `UPDATE roles SET org_id = ?, updated_at = NOW() WHERE id = ?`,
            [targetOrgId, roleId]
        )
        return ret.affectedRows > 0 ? 1 : 0
    }

    /** 单机构：只在当前 org_id 等于 orgId 时清空 */
    static async removeRoleOrg(roleId: number, orgId: number): Promise<void> {
        await pool.query(`UPDATE roles SET org_id = NULL, updated_at = NOW() WHERE id = ? AND org_id = ?`, [roleId, orgId])
    }
}
