/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { IUser, IRoleRow } from '../domain/auth.model'

type RoleRow = RowDataPacket & { id: number; code: string }
type DefaultRoleRow = RowDataPacket & { role_id: number }

export class UserRepository {
  static async findByEmail(email: string): Promise<IUser | null> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM users WHERE email=? LIMIT 1`, [email])
    return (rows[0] as unknown as IUser) || null
  }

  static async findById(id: number): Promise<IUser | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, email, status, created_at, updated_at FROM users WHERE id=? LIMIT 1`,
      [id]
    )
    return (rows[0] as unknown as IUser) || null
  }

  static async insertUser(username: string, email: string, hashed: string): Promise<number> {
    const [rs] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (username, email, password, status) VALUES (?, ?, ?, 'active')`,
      [username, email, hashed]
    )
    return rs.insertId
  }

  static async rolesOfUser(userId: number): Promise<{ roles: { id: number; code: string }[]; roleIds: number[] }> {
    const [rows] = await pool.query<RoleRow[]>(
      `SELECT r.id, r.code
         FROM roles r
         JOIN user_org_roles ur ON ur.role_id=r.id
        WHERE ur.user_id=?`,
      [userId]
    )
    const roles = rows.map((r: RoleRow) => ({ id: Number(r.id), code: String(r.code) }))
    return { roles, roleIds: roles.map((r: { id: number; code: string }) => r.id) }
  }
}

export class OrgRepository {
  static async getDefaultOrgId(): Promise<number> {
    const [[org]] = await pool.query<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
    const orgId = Number((org as any)?.id)
    if (!orgId) throw new Error('默认机构不存在，请先执行迁移脚本')
    return orgId
  }

  static async attachUserToOrg(userId: number, orgId: number) {
    await pool.query(
      `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at) VALUES (?, ?, 1, NOW())`,
      [userId, orgId]
    )
  }

  static async defaultRoleIdsOfOrg(orgId: number): Promise<number[]> {
    const [defs] = await pool.query<DefaultRoleRow[]>(`SELECT role_id FROM org_default_roles WHERE org_id=?`, [orgId])
    return defs.map((r: DefaultRoleRow) => Number(r.role_id))
  }

  static async ensureUserRoles(userId: number, orgId: number, roleIds: number[]) {
    for (const rid of roleIds) {
      await pool.query(
        `INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at) VALUES (?, ?, ?, NOW())`,
        [userId, orgId, rid]
      )
    }
  }

  static async findRoleIdByCode(code: string): Promise<number | null> {
    const [[row]] = await pool.query<RowDataPacket[]>(`SELECT id FROM roles WHERE code=? LIMIT 1`, [code])
    return row ? Number((row as any).id) : null
  }
}
