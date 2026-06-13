// apps/backend/src/modules/notifications/repositories/notification.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { INotification } from '../domain/notification.types.js'

// ---- 关键：最小可查询接口，避免与外部 Pool 类型冲突 ----
type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}
const db: Queryable = pool as unknown as Queryable

type NotificationInsertPayload = {
  user_id: number
  title: string
  content: string
  type?: string
  attachments?: any
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

export class NotificationRepository {
  private static mapRows(rows: INotification[]) {
    return rows.map(r => {
      const attachments = parseJson(r.attachments) || []
      const metadata = parseJson((r as any).metadata)
      return { ...r, attachments, metadata: metadata ?? null }
    })
  }

  static async findByUser(userId: number) {
    const [rows] = await db.query<INotification[]>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )
    return this.mapRows(rows as INotification[])
  }

  static async countUnread(userId: number) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false',
      [userId]
    )
    return Number((rows as any[])[0]?.count ?? 0)
  }

  static async markRead(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>(
      'UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    return ret.affectedRows > 0
  }

  static async markAllRead(userId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      'UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false',
      [userId]
    )
    return ret.affectedRows
  }

  static async insertOne(payload: NotificationInsertPayload) {
    const { user_id, title, content, type = 'info', attachments, source = 'system', target_path = null, metadata } = payload
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, title, content, type, attachments, source, target_path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        title,
        content,
        type,
        attachments ? JSON.stringify(attachments) : null,
        source,
        target_path,
        metadata ? JSON.stringify(metadata) : null,
      ]
    )
    return ret.insertId
  }

  static async insertMany(payloads: NotificationInsertPayload[]) {
    if (!payloads.length) return 0
    const placeholders = payloads.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const flat = payloads.flatMap(item => [
      item.user_id,
      item.title,
      item.content,
      item.type ?? 'info',
      item.attachments ? JSON.stringify(item.attachments) : null,
      item.source ?? 'system',
      item.target_path ?? null,
      item.metadata ? JSON.stringify(item.metadata) : null,
    ])
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO notifications (user_id, title, content, type, attachments, source, target_path, metadata)
       VALUES ${placeholders}`,
      flat
    )
    return ret.affectedRows
  }

  static async deleteOne(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM notifications WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ])
    return ret.affectedRows > 0
  }

  static async adminListAll() {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT n.*, u.username, u.real_name 
       FROM notifications n 
       LEFT JOIN users u ON n.user_id = u.id 
       ORDER BY n.created_at DESC`
    )
    return this.mapRows(rows as unknown as INotification[])
  }

  static async adminDeleteById(id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM notifications WHERE id = ?', [id])
    return ret.affectedRows > 0
  }
}
