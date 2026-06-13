import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Integration } from '../domain/integration.model'

export type IntegrationPayload = {
  name?: string
  type?: string
  endpoint?: string | null
  config?: any
  enabled?: number
  description?: string | null
}

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export const IntegrationRepository = {
  async list(type?: string): Promise<Integration[]> {
    const sql = type ? 'SELECT * FROM integrations WHERE type = ? ORDER BY id DESC' : 'SELECT * FROM integrations ORDER BY id DESC'
    const params = type ? [type] : []
    const [rows] = await db.query<Integration[] & RowDataPacket[]>(sql, params)
    return rows as Integration[]
  },

  async create(payload: IntegrationPayload): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO integrations (name, type, endpoint, config, enabled, description) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.name, payload.type, payload.endpoint ?? null, payload.config ?? null, payload.enabled ?? true, payload.description ?? null]
    )
    return ret.insertId
  },

  async update(id: number, payload: IntegrationPayload): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    ;(['name', 'type', 'endpoint', 'config', 'enabled', 'description'] as const).forEach(key => {
      if (payload[key] !== undefined) {
        sets.push(`${key} = ?`)
        vals.push(payload[key] as any)
      }
    })
    if (!sets.length) return 0
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE integrations SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async remove(id: number): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM integrations WHERE id = ?', [id])
    return ret.affectedRows
  },
}
