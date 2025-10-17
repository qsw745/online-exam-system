// apps/backend/src/modules/messages/repositories/message.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IMessage } from '../domain/message.model'

type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const db: Queryable = pool as unknown as Queryable

export class MessageRepository {
  static async findByUser(userId: number) {
    const [rows] = await db.query<IMessage[]>('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC', [
      userId,
    ])
    return rows
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

  static async insertOne(user_id: number, title: string, content: string, type: string) {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)',
      [user_id, title, content, type]
    )
    return ret.insertId
  }

  static async insertMany(values: Array<[number, string, string, string]>) {
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ')
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO messages (user_id, title, content, type) VALUES ${placeholders}`,
      values.flat()
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
    return rows
  }

  static async adminDeleteById(id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM messages WHERE id = ?', [id])
    return ret.affectedRows > 0
  }
}
