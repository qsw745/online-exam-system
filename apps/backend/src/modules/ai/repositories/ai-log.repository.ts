import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export type AiChatLogRow = {
  id: number
  user_id: number
  session_id: string | null
  model: string | null
  messages_json: string
  content_text: string
  action_json: string | null
  created_at: string
  nickname?: string | null
  email?: string | null
}

export type AiLogFilter = {
  userId?: number
  isAdmin?: boolean
  model?: string
  keyword?: string
  sessionId?: string
  startAt?: string
  endAt?: string
  limit?: number
  offset?: number
}

const buildWhere = (filter: AiLogFilter) => {
  const where: string[] = []
  const params: any[] = []

  if (!filter.isAdmin && filter.userId) {
    where.push('l.user_id = ?')
    params.push(filter.userId)
  } else if (filter.userId) {
    where.push('l.user_id = ?')
    params.push(filter.userId)
  }

  if (filter.model) {
    where.push('l.model = ?')
    params.push(filter.model)
  }

  if (filter.sessionId) {
    where.push('l.session_id = ?')
    params.push(filter.sessionId)
  }

  if (filter.keyword) {
    where.push('l.content_text LIKE ?')
    params.push(`%${filter.keyword}%`)
  }

  if (filter.startAt) {
    where.push('l.created_at >= ?')
    params.push(filter.startAt)
  }

  if (filter.endAt) {
    where.push('l.created_at <= ?')
    params.push(filter.endAt)
  }

  const sql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return { sql, params }
}

export class AiLogRepository {
  static async insert(input: {
    userId: number
    sessionId?: string | null
    model?: string | null
    messagesJson: string
    contentText: string
    actionJson?: string | null
  }): Promise<void> {
    await db.query<ResultSetHeader>(
      `INSERT INTO ai_chat_logs (user_id, session_id, model, messages_json, content_text, action_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        input.userId,
        input.sessionId ?? null,
        input.model ?? null,
        input.messagesJson,
        input.contentText,
        input.actionJson ?? null,
      ]
    )
  }

  static async list(filter: AiLogFilter): Promise<AiChatLogRow[]> {
    const { sql, params } = buildWhere(filter)
    const limit = Number(filter.limit || 20)
    const offset = Number(filter.offset || 0)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT l.id, l.user_id, l.session_id, l.model, l.messages_json, l.content_text, l.action_json, l.created_at,
              u.nickname, u.email
         FROM ai_chat_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ${sql}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    return (rows || []) as AiChatLogRow[]
  }

  static async count(filter: AiLogFilter): Promise<number> {
    const { sql, params } = buildWhere(filter)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(1) AS total
         FROM ai_chat_logs l
         ${sql}`,
      params
    )
    return Number((rows as any)?.[0]?.total || 0)
  }

  static async exportList(filter: AiLogFilter): Promise<AiChatLogRow[]> {
    const { sql, params } = buildWhere(filter)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT l.id, l.user_id, l.session_id, l.model, l.messages_json, l.content_text, l.action_json, l.created_at,
              u.nickname, u.email
         FROM ai_chat_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ${sql}
        ORDER BY l.created_at DESC`,
      params
    )
    return (rows || []) as AiChatLogRow[]
  }

  static async cleanupBefore(dateTime: string): Promise<number> {
    const [res] = await db.query<ResultSetHeader>(
      `DELETE FROM ai_chat_logs WHERE created_at < ?`,
      [dateTime]
    )
    return Number(res?.affectedRows || 0)
  }
}
