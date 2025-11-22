import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { SystemConfig } from '../domain/config.model'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export const ConfigRepository = {
  async list(): Promise<SystemConfig[]> {
    const [rows] = await db.query<SystemConfig[] & RowDataPacket[]>(
      'SELECT * FROM system_configs ORDER BY config_key ASC'
    )
    return rows as SystemConfig[]
  },

  async getByKey(key: string): Promise<SystemConfig | null> {
    const [rows] = await db.query<SystemConfig[] & RowDataPacket[]>(
      'SELECT * FROM system_configs WHERE config_key = ? LIMIT 1',
      [key]
    )
    return (rows as SystemConfig[])[0] || null
  },

  async create(payload: Partial<SystemConfig>): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO system_configs (config_key, config_name, config_value, value_type, enabled, description) VALUES (?, ?, ?, ?, ?, ?)',
      [
        payload.config_key,
        payload.config_name,
        payload.config_value ?? null,
        payload.value_type ?? 'text',
        payload.enabled ?? true,
        payload.description ?? null,
      ]
    )
    return ret.insertId
  },

  async update(id: number, payload: Partial<SystemConfig>): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    if (payload.config_key !== undefined) {
      sets.push('config_key = ?')
      vals.push(payload.config_key)
    }
    if (payload.config_name !== undefined) {
      sets.push('config_name = ?')
      vals.push(payload.config_name)
    }
    if (payload.config_value !== undefined) {
      sets.push('config_value = ?')
      vals.push(payload.config_value)
    }
    if (payload.value_type !== undefined) {
      sets.push('value_type = ?')
      vals.push(payload.value_type)
    }
    if (payload.enabled !== undefined) {
      sets.push('enabled = ?')
      vals.push(payload.enabled)
    }
    if (payload.description !== undefined) {
      sets.push('description = ?')
      vals.push(payload.description)
    }
    if (!sets.length) return 0
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE system_configs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async remove(id: number): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM system_configs WHERE id = ?', [id])
    return ret.affectedRows
  },
}
