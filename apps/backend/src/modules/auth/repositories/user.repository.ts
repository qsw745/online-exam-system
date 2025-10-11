/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool as basePool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IUser } from '../domain/auth.model'

interface DBPool {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}
const pool = basePool as unknown as DBPool

type RoleRow = RowDataPacket & { id: number; code: string }
type DefaultRoleRow = RowDataPacket & { role_id: number }

export class UserRepository {
  static async findByEmail(email: string): Promise<IUser | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM users WHERE email=? LIMIT 1`, [email])
    return (rows[0] as unknown as IUser) || null
  }

  static async findByUsername(username: string): Promise<IUser | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM users WHERE username=? LIMIT 1`, [username])
    return (rows[0] as unknown as IUser) || null
  }

  /** 登录用：优先按 email，再按 username；反之亦然，避免 (email OR username) 误命中 */
  static async findByLogin(login: string): Promise<IUser | null> {
    const v = String(login || '').trim()
    if (!v) return null

    if (v.includes('@')) {
      const byEmail = await this.findByEmail(v)
      if (byEmail) return byEmail
      return this.findByUsername(v)
    }

    const byName = await this.findByUsername(v)
    if (byName) return byName
    return this.findByEmail(v)
  }

  static async findById(id: number): Promise<IUser | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, username, email, status, created_at, updated_at FROM users WHERE id=? LIMIT 1`,
      [id]
    )
    return (rows[0] as unknown as IUser) || null
  }

  static async insertUser(username: string, email: string, hashed: string): Promise<number> {
    const [rs] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password, status) VALUES (?, ?, ?, 'active')`,
      [username, email, hashed]
    )
    return rs.insertId
  }

  static async rolesOfUser(userId: number): Promise<{ roles: { id: number; code: string }[]; roleIds: number[] }> {
    const [rows] = await pool.execute<RoleRow[]>(
      `SELECT r.id, r.code
         FROM roles r
         JOIN user_org_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?`,
      [userId]
    )
    const roles = rows.map(r => ({ id: Number(r.id), code: String(r.code) }))
    return { roles, roleIds: roles.map(r => r.id) }
  }
}

export class OrgRepository {
  static async getDefaultOrgId(): Promise<number> {
    const [orgRows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
    const org = orgRows[0] as RowDataPacket | undefined
    const orgId = Number((org as any)?.id)
    if (!orgId) throw new Error('默认机构不存在，请先执行迁移脚本')
    return orgId
  }

  static async attachUserToOrg(userId: number, orgId: number) {
    await pool.execute(
      `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at) VALUES (?, ?, 1, NOW())`,
      [userId, orgId]
    )
  }

  static async defaultRoleIdsOfOrg(orgId: number): Promise<number[]> {
    const [defs] = await pool.execute<DefaultRoleRow[]>(`SELECT role_id FROM org_default_roles WHERE org_id=?`, [orgId])
    return defs.map(r => Number(r.role_id))
  }

  static async ensureUserRoles(userId: number, orgId: number, roleIds: number[]) {
    for (const rid of roleIds) {
      await pool.execute(
        `INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at) VALUES (?, ?, ?, NOW())`,
        [userId, orgId, rid]
      )
    }
  }

  static async findRoleIdByCode(code: string): Promise<number | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM roles WHERE code=? LIMIT 1`, [code])
    const row = rows[0] as RowDataPacket | undefined
    return row ? Number((row as any).id) : null
  }
}
