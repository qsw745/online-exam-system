import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export type NotificationAttachment = {
  id: number
  file_name: string
  file_path: string
  file_hash: string
  file_size: number
  mime_type?: string | null
  url: string
  created_at: Date
}

export class NotificationAttachmentRepository {
  static async findByHash(hash: string): Promise<NotificationAttachment | null> {
    const [rows] = await db.query<NotificationAttachment[] & RowDataPacket[]>(
      'SELECT * FROM notification_attachments WHERE file_hash = ? LIMIT 1',
      [hash]
    )
    return (rows as NotificationAttachment[])[0] || null
  }

  static async findById(id: number): Promise<NotificationAttachment | null> {
    const [rows] = await db.query<NotificationAttachment[] & RowDataPacket[]>(
      'SELECT * FROM notification_attachments WHERE id = ? LIMIT 1',
      [id]
    )
    return (rows as NotificationAttachment[])[0] || null
  }

  static async insert(payload: {
    file_name: string
    file_path: string
    file_hash: string
    file_size: number
    mime_type?: string | null
    url: string
  }): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO notification_attachments (file_name, file_path, file_hash, file_size, mime_type, url) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.file_name, payload.file_path, payload.file_hash, payload.file_size, payload.mime_type ?? null, payload.url]
    )
    return ret.insertId
  }
}
