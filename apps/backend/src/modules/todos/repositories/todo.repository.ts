// apps/backend/src/modules/todos/repositories/todo.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { ITodo } from '../domain/todo.model'

type Queryable = { query<T = any>(sql: string, params?: any[]): Promise<[T, any]> }
const db: Queryable = pool as unknown as Queryable

type TodoInsertPayload = {
  user_id: number
  title: string
  content: string
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

export class TodoRepository {
  static async findByUser(userId: number) {
    // 把 is_done 别名成 done，直接契合前端
    const [rows] = await db.query<ITodo[]>(
      `SELECT id,
              user_id,
              title,
              content,
              is_done AS done,
              created_at,
              updated_at,
              source,
              target_path,
              metadata
         FROM todos
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      [userId]
    )
    return (rows as any[]).map(r => ({ ...r, metadata: parseJson((r as any).metadata) }))
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

  static async insertOne(payload: TodoInsertPayload) {
    const { user_id, title, content, source = 'todo', target_path = null, metadata } = payload
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO todos (user_id, title, content, source, target_path, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, title, content, source, target_path, metadata ? JSON.stringify(metadata) : null]
    )
    return ret.insertId
  }

  static async insertMany(payloads: TodoInsertPayload[]) {
    if (!payloads.length) return 0
    const placeholders = payloads.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const flat = payloads.flatMap(p => [
      p.user_id,
      p.title,
      p.content,
      p.source ?? 'todo',
      p.target_path ?? null,
      p.metadata ? JSON.stringify(p.metadata) : null,
    ])
    const [ret] = await db.query<ResultSetHeader>(
      `INSERT INTO todos (user_id, title, content, source, target_path, metadata) VALUES ${placeholders}`,
      flat
    )
    return ret.affectedRows
  }

  static async deleteOne(userId: number, id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, userId])
    return ret.affectedRows > 0
  }

  static async markDoneByWorkflowMeta(userId: number, instanceId: number, nodeId: string) {
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE todos
       SET is_done = true
       WHERE user_id = ? AND source = 'workflow' AND is_done = false
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.instance_id')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.node_id')) = ?`,
      [userId, String(instanceId), String(nodeId)]
    )
    return ret.affectedRows
  }

  static async markDoneByWorkflowNode(instanceId: number, nodeId: string) {
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE todos
       SET is_done = true
       WHERE source = 'workflow' AND is_done = false
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.instance_id')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.node_id')) = ?`,
      [String(instanceId), String(nodeId)]
    )
    return ret.affectedRows
  }

  static async deleteByWorkflowEntity(entityType: string, entityId: number) {
    const [ret] = await db.query<ResultSetHeader>(
      `DELETE FROM todos
       WHERE source = 'workflow'
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.entity_type')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.entity_id')) = ?`,
      [String(entityType), String(entityId)]
    )
    return ret.affectedRows
  }

  // admin
  static async adminListAll() {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT t.*, u.username, u.real_name
       FROM todos t
       LEFT JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC`
    )
    return (rows as any[]).map(r => ({ ...r, metadata: parseJson((r as any).metadata) }))
  }

  static async adminDeleteById(id: number) {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM todos WHERE id = ?', [id])
    return ret.affectedRows > 0
  }
}
