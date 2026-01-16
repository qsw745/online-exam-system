import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export type AiChatSessionRow = {
  client_id: string
  title: string | null
  items_json: string
  created_at: string
  updated_at: string
}

export class AiSessionRepository {
  static async listByUser(userId: number): Promise<AiChatSessionRow[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT client_id, title, items_json, created_at, updated_at
         FROM ai_chat_sessions
        WHERE user_id = ?
        ORDER BY updated_at DESC`,
      [userId]
    )
    return (rows || []) as AiChatSessionRow[]
  }

  static async upsertSession(input: {
    userId: number
    clientId: string
    title?: string | null
    itemsJson: string
  }): Promise<void> {
    await db.query<ResultSetHeader>(
      `INSERT INTO ai_chat_sessions (user_id, client_id, title, items_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         items_json = VALUES(items_json),
         updated_at = NOW()`,
      [input.userId, input.clientId, input.title ?? null, input.itemsJson]
    )
  }

  static async deleteSession(userId: number, clientId: string): Promise<boolean> {
    const [res] = await db.query<ResultSetHeader>(
      `DELETE FROM ai_chat_sessions WHERE user_id = ? AND client_id = ?`,
      [userId, clientId]
    )
    return Number(res?.affectedRows || 0) > 0
  }
}
