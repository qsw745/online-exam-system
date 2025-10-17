// apps/backend/src/modules/todos/services/todo.service.ts
import type { ITodo, TodoListData } from '../domain/todo.model'
import { TodoRepository } from '../repositories/todo.repository.js'
import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2'

export class TodoService {
  static async create(currentUserId: number, payload: { user_id: number; title: string; content: string }) {
    await this.assertRole(currentUserId, ['admin', 'teacher'])
    const id = await TodoRepository.insertOne(payload.user_id, payload.title, payload.content)
    const [rows] = await pool.query<ITodo[]>(
      'SELECT id, user_id, title, content, is_done AS done, created_at, updated_at FROM todos WHERE id = ?',
      [id]
    )
    return rows[0]
  }

  static async createBatch(currentUserId: number, payload: { user_ids: number[]; title: string; content: string }) {
    await this.assertRole(currentUserId, ['admin', 'teacher'])
    const values = payload.user_ids.map(uid => [uid, payload.title, payload.content] as [number, string, string])
    const count = await TodoRepository.insertMany(values)
    return { count }
  }

  static async list(userId: number): Promise<TodoListData> {
    const todos = await TodoRepository.findByUser(userId)
    const pendingCount = await TodoRepository.countPending(userId)
    return { todos, pendingCount }
  }

  static async pendingCount(userId: number) {
    return { pendingCount: await TodoRepository.countPending(userId) }
  }

  static async markDone(userId: number, id: number) {
    return await TodoRepository.markDone(userId, id)
  }

  static async markAllDone(userId: number) {
    const count = await TodoRepository.markAllDone(userId)
    return { count }
  }

  static async remove(userId: number, id: number) {
    return await TodoRepository.deleteOne(userId, id)
  }

  // admin
  static async adminList(currentUserId: number) {
    await this.assertRole(currentUserId, ['admin'])
    return await TodoRepository.adminListAll()
  }
  static async adminDelete(currentUserId: number, id: number) {
    await this.assertRole(currentUserId, ['admin'])
    return await TodoRepository.adminDeleteById(id)
  }

  private static async assertRole(userId: number, roles: string[]) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [userId])
    const role = rows[0]?.role
    if (!role || !roles.includes(role)) {
      const err: any = new Error('权限不足')
      err.status = 403
      throw err
    }
  }
}
