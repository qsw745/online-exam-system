// apps/backend/src/modules/messages/repositories/message.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IMessage } from '../domain/message.model'

type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const db: Queryable = pool as unknown as Queryable

type MessageInsertPayload = {
  user_id: number
  title: string
  content: string
  type?: string
  source?: string
  target_path?: string | null
  metadata?: any
}

const parseJson = (value: any) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value as string)
  } catch {
    return null
  }
}

export class MessageRepository {
  static async findByUser(userId: number) {
    const [rows] = await db.query<IMessage[]>('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC', [
      userId,
    ])
    return (rows as any[]).map(r => ({ ...r, metadata: parseJson((r as any).metadata) }))
  }

  static async countUnread(userId: number) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM messages WHERE user_id = ? AND is_read = false',
      [userId]
    )
    return Number((rows as any[])[0]?.count ?? 0)
  }

  static async markRead(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>('UPDATE messages SET is_read = true WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ])
    return ret.affectedRows > 0
  }

  static async markAllRead(userId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      'UPDATE messages SET is_read = true WHERE user_id = ? AND is_read = false',
      [userId]
    )
    return ret.affectedRows
  }

  static async insertOne(payload: MessageInsertPayload) {
    const { user_id, title, content, type = 'info', source = 'message', target_path = null, metadata } = payload
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO messages (user_id, title, content, type, source, target_path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, title, content, type, source, target_path, metadata ? JSON.stringify(metadata) : null]
    )
    return ret.insertId
  }

  static async insertMany(payloads: MessageInsertPayload[]) {
    if (!payloads.length) return 0
    const placeholders = payloads.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')
    const flat = payloads.flatMap(p => [
      p.user_id,
      p.title,
      p.content,
      p.type ?? 'info',
      p.source ?? 'message',
      p.target_path ?? null,
      p.metadata ? JSON.stringify(p.metadata) : null,
    ])
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO messages (user_id, title, content, type, source, target_path, metadata) VALUES ${placeholders}`,
      flat
    )
    return ret.affectedRows
  }

  static async deleteOne(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM messages WHERE id = ? AND user_id = ?', [id, userId])
    return ret.affectedRows > 0
  }

  // admin
  static async adminListAll() {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT m.*, u.username, u.real_name
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC`
    )
    return (rows as any[]).map(r => ({ ...r, metadata: parseJson((r as any).metadata) }))
  }

  static async adminDeleteById(id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM messages WHERE id = ?', [id])
    return ret.affectedRows > 0
  }
}
