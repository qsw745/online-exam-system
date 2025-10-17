// apps/backend/src/modules/todos/repositories/todo.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { ITodo } from '../domain/todo.model'

type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const db: Queryable = pool as unknown as Queryable

export class TodoRepository {
  static async findByUser(userId: number) {
    // 把 is_done 别名成 done，直接契合前端
    const [rows] = await db.query<ITodo[]>(
      'SELECT id, user_id, title, content, is_done AS done, created_at, updated_at FROM todos WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )
    return rows
  }

  static async countPending(userId: number) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM todos WHERE user_id = ? AND is_done = false',
      [userId]
    )
    return Number((rows as any[])[0]?.count ?? 0)
  }

  static async markDone(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>('UPDATE todos SET is_done = true WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ])
    return ret.affectedRows > 0
  }

  static async markAllDone(userId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      'UPDATE todos SET is_done = true WHERE user_id = ? AND is_done = false',
      [userId]
    )
    return ret.affectedRows
  }

  static async insertOne(user_id: number, title: string, content: string) {
    const [ret] = await db.query<ResultSetHeader>('INSERT INTO todos (user_id, title, content) VALUES (?, ?, ?)', [
      user_id,
      title,
      content,
    ])
    return ret.insertId
  }

  static async insertMany(values: Array<[number, string, string]>) {
    const placeholders = values.map(() => '(?, ?, ?)').join(', ')
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO todos (user_id, title, content) VALUES ${placeholders}`,
      values.flat()
    )
    return ret.affectedRows
  }

  static async deleteOne(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, userId])
    return ret.affectedRows > 0
  }

  // admin
  static async adminListAll() {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT t.*, u.username, u.real_name
       FROM todos t
       LEFT JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC`
    )
    return rows
  }

  static async adminDeleteById(id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM todos WHERE id = ?', [id])
    return ret.affectedRows > 0
  }
}
