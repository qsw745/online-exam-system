// apps/backend/src/modules/orgs/repositories/org.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IOrg } from '../domain/org.model.js'

export class OrgRepository {
  static async list(params: {
    page: number
    limit: number
    search?: string
    parentId?: number | null
    includeInactive?: boolean
  }): Promise<{ rows: IOrg[]; total: number }> {
    const { page, limit, search, parentId, includeInactive } = params
    const offset = (page - 1) * limit
    const where: string[] = []
    const vals: any[] = []
    if (search) {
      where.push('(name LIKE ? OR code LIKE ?)')
      vals.push(`%${search}%`, `%${search}%`)
    }
    if (typeof parentId !== 'undefined') {
      where.push('parent_id <=> ?')
      vals.push(parentId)
    }
    if (!includeInactive) where.push('is_active = 1')

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [rows] = await pool.query<IOrg[]>(
      `SELECT id, name, code, parent_id, is_active, created_at, updated_at
       FROM organizations ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    )
    const [[cnt]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM organizations ${whereSql}`, vals)
    return { rows, total: Number((cnt as any)?.total) || 0 }
  }

  static async findAll(includeInactive: boolean): Promise<IOrg[]> {
    const [rows] = await pool.query<IOrg[]>(
      `SELECT id, name, code, parent_id, is_active, created_at, updated_at
       FROM organizations ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY id ASC`
    )
    return rows
  }

  static async findById(id: number): Promise<IOrg | null> {
    const [rows] = await pool.query<IOrg[]>(
      `SELECT id, name, code, parent_id, is_active, created_at, updated_at
       FROM organizations WHERE id=? LIMIT 1`,
      [id]
    )
    return rows[0] ?? null
  }

  static async codeExists(code: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT code FROM organizations WHERE code=? LIMIT 1`, [code])
    return (rows as any[]).length > 0
  }

  static async listSimilarCodes(base: string): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT code FROM organizations WHERE code = ? OR code LIKE CONCAT(?, '-%')`,
      [base, base]
    )
    return (rows as any[]).map(r => String(r.code))
  }

  static async insertOrg(data: {
    name: string
    code: string
    parent_id: number | null
    is_active: 0 | 1
  }): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO organizations (name, code, parent_id, is_active, created_at, updated_at)
       VALUES (?,?,?,?,NOW(),NOW())`,
      [data.name, data.code, data.parent_id, data.is_active]
    )
    return ret.insertId
  }

  static async updateOrg(
    id: number,
    patch: Partial<Pick<IOrg, 'name' | 'code' | 'parent_id' | 'is_active'>>
  ): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    if (patch.name !== undefined) {
      sets.push('name=?')
      vals.push(patch.name)
    }
    if (patch.code !== undefined) {
      sets.push('code=?')
      vals.push(patch.code)
    }
    if (patch.is_active !== undefined) {
      sets.push('is_active=?')
      vals.push(patch.is_active)
    }
    if (patch.parent_id !== undefined) {
      sets.push('parent_id=?')
      vals.push(patch.parent_id)
    }
    if (sets.length === 0) return 0
    sets.push('updated_at=NOW()')
    vals.push(id)
    const [ret] = await pool.query<ResultSetHeader>(`UPDATE organizations SET ${sets.join(', ')} WHERE id=?`, vals)
    return ret.affectedRows
  }

  static async deleteOrg(id: number): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>('DELETE FROM organizations WHERE id=?', [id])
    return ret.affectedRows
  }

  static async hasChildren(id: number): Promise<boolean> {
    const [[row]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM organizations WHERE parent_id=?', [
      id,
    ])
    return Number((row as any)?.cnt || 0) > 0
  }

  static async allForCycleCheck(): Promise<Array<Pick<IOrg, 'id' | 'parent_id'>>> {
    const [rows] = await pool.query<Array<Pick<IOrg, 'id' | 'parent_id'>>>('SELECT id, parent_id FROM organizations')
    return rows
  }
}
