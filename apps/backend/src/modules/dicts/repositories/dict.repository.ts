import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Dictionary, DictionaryItem } from '../domain/dict.model'

export type DictionaryPayload = {
  code?: string
  name?: string
  description?: string | null
  enabled?: number
  sort_order?: number
}

export type DictionaryItemPayload = {
  label?: string
  value?: string
  tag?: string | null
  enabled?: number
  sort_order?: number
}

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export const DictRepository = {
  async list(): Promise<Dictionary[]> {
    const [rows] = await db.query<Dictionary[] & RowDataPacket[]>(
      'SELECT * FROM dictionaries ORDER BY sort_order ASC, id ASC'
    )
    return rows as Dictionary[]
  },

  async listItems(dictId: number): Promise<DictionaryItem[]> {
    const [rows] = await db.query<DictionaryItem[] & RowDataPacket[]>(
      'SELECT * FROM dictionary_items WHERE dict_id = ? ORDER BY sort_order ASC, id ASC',
      [dictId]
    )
    return rows as DictionaryItem[]
  },

  async create(dict: DictionaryPayload): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO dictionaries (code, name, description, enabled, sort_order) VALUES (?, ?, ?, ?, ?)',
      [dict.code, dict.name, dict.description ?? null, dict.enabled ?? true, dict.sort_order ?? 0]
    )
    return ret.insertId
  },

  async update(id: number, dict: DictionaryPayload): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    if (dict.code !== undefined) {
      sets.push('code = ?')
      vals.push(dict.code)
    }
    if (dict.name !== undefined) {
      sets.push('name = ?')
      vals.push(dict.name)
    }
    if (dict.description !== undefined) {
      sets.push('description = ?')
      vals.push(dict.description)
    }
    if (dict.enabled !== undefined) {
      sets.push('enabled = ?')
      vals.push(dict.enabled)
    }
    if (dict.sort_order !== undefined) {
      sets.push('sort_order = ?')
      vals.push(dict.sort_order)
    }
    if (!sets.length) return 0
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE dictionaries SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async remove(id: number): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM dictionaries WHERE id = ?', [id])
    return ret.affectedRows
  },

  async createItem(dictId: number, payload: DictionaryItemPayload): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO dictionary_items (dict_id, label, value, tag, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [dictId, payload.label, payload.value, payload.tag ?? null, payload.enabled ?? true, payload.sort_order ?? 0]
    )
    return ret.insertId
  },

  async updateItem(id: number, payload: DictionaryItemPayload): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    if (payload.label !== undefined) {
      sets.push('label = ?')
      vals.push(payload.label)
    }
    if (payload.value !== undefined) {
      sets.push('value = ?')
      vals.push(payload.value)
    }
    if (payload.tag !== undefined) {
      sets.push('tag = ?')
      vals.push(payload.tag)
    }
    if (payload.enabled !== undefined) {
      sets.push('enabled = ?')
      vals.push(payload.enabled)
    }
    if (payload.sort_order !== undefined) {
      sets.push('sort_order = ?')
      vals.push(payload.sort_order)
    }
    if (!sets.length) return 0
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE dictionary_items SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async removeItem(id: number): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM dictionary_items WHERE id = ?', [id])
    return ret.affectedRows
  },
}
