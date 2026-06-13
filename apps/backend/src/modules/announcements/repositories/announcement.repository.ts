import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Announcement } from '../domain/announcement.model'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export class AnnouncementRepository {
  static async listPublished(): Promise<Announcement[]> {
    const [rows] = await db.query<Announcement[] & RowDataPacket[]>(
      `SELECT * FROM announcements 
       WHERE status = 'published' 
       ORDER BY COALESCE(published_at, updated_at) DESC`
    )
    return rows as Announcement[]
  }

  static async listAll(): Promise<Announcement[]> {
    const [rows] = await db.query<Announcement[] & RowDataPacket[]>(
      'SELECT * FROM announcements ORDER BY updated_at DESC'
    )
    return rows as Announcement[]
  }

  static async findById(id: number): Promise<Announcement | null> {
    const [rows] = await db.query<Announcement[] & RowDataPacket[]>('SELECT * FROM announcements WHERE id = ? LIMIT 1', [
      id,
    ])
    return (rows as Announcement[])[0] || null
  }

  static async create(payload: {
    title: string
    content: string
    status?: 'draft' | 'published'
    published_at?: Date | null
    created_by?: number | null
  }): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO announcements (title, content, status, published_at, created_by) VALUES (?, ?, ?, ?, ?)`,
      [payload.title, payload.content, payload.status ?? 'draft', payload.published_at ?? null, payload.created_by ?? null]
    )
    return ret.insertId
  }

  static async update(
    id: number,
    payload: Partial<{ title: string; content: string; status: 'draft' | 'published'; published_at: Date | null }>
  ): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    if (payload.title !== undefined) {
      sets.push('title = ?')
      vals.push(payload.title)
    }
    if (payload.content !== undefined) {
      sets.push('content = ?')
      vals.push(payload.content)
    }
    if (payload.status !== undefined) {
      sets.push('status = ?')
      vals.push(payload.status)
    }
    if (payload.published_at !== undefined) {
      sets.push('published_at = ?')
      vals.push(payload.published_at)
    }
    if (!sets.length) return 0
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE announcements SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  }

  static async delete(id: number): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM announcements WHERE id = ?', [id])
    return ret.affectedRows
  }
}
