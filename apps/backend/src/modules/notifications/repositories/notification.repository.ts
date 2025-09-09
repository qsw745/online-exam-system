// apps/backend/src/modules/notifications/repositories/notification.repository.ts
import { pool } from '@config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { INotification } from '../domain/notification.types.js'

export class NotificationRepository {
  static async findByUser(userId: number) {
    const [rows] = await pool.query<INotification[]>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )
    return rows
  }

  static async countUnread(userId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false',
      [userId]
    )
    return Number(rows[0]?.count ?? 0)
  }

  static async markRead(userId: number, id: number) {
    const [ret] = await pool.query<ResultSetHeader>(
      'UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    return ret.affectedRows > 0
  }

  static async markAllRead(userId: number) {
    const [ret] = await pool.query<ResultSetHeader>(
      'UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false',
      [userId]
    )
    return ret.affectedRows
  }

  static async insertOne(user_id: number, title: string, content: string, type: string) {
    const [ret] = await pool.query<ResultSetHeader>(
      'INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)',
      [user_id, title, content, type]
    )
    return ret.insertId
  }

  static async insertMany(values: Array<[number, string, string, string]>) {
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ')
    const flat = values.flat()
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, title, content, type) VALUES ${placeholders}`,
      flat
    )
    return ret.affectedRows
  }

  static async deleteOne(userId: number, id: number) {
    const [ret] = await pool.query<ResultSetHeader>('DELETE FROM notifications WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ])
    return ret.affectedRows > 0
  }

  static async adminListAll() {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT n.*, u.username, u.real_name 
       FROM notifications n 
       LEFT JOIN users u ON n.user_id = u.id 
       ORDER BY n.created_at DESC`
    )
    return rows
  }

  static async adminDeleteById(id: number) {
    const [ret] = await pool.query<ResultSetHeader>('DELETE FROM notifications WHERE id = ?', [id])
    return ret.affectedRows > 0
  }
}
