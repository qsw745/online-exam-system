// apps/backend/src/modules/tasks/repositories/task.repository.ts
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '@config/database.js'
import type {
  TaskDTO,
  TaskListQuery,
  TaskListResult,
  TaskWithAssigned,
  UpdateTaskInput,
} from '../domain/task.entity.js'

export class TaskRepository {
  constructor(private readonly db: Pool = pool) {}

  async countForList(q: TaskListQuery): Promise<number> {
    const params: any[] = []
    let where = ''

    if (q.userRole === 'student') {
      where = 'WHERE t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
      params.push(q.userId)
    } else {
      where = 'WHERE 1=1'
    }

    if (q.search) {
      where += ' AND (t.title LIKE ? OR t.description LIKE ?)'
      params.push(`%${q.search}%`, `%${q.search}%`)
    }

    if (q.status) {
      where += ' AND t.status = ?'
      params.push(q.status)
    }

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT t.id) AS total
         FROM tasks t
    LEFT JOIN task_assignments ta ON t.id = ta.task_id
    LEFT JOIN users u ON ta.user_id = u.id
       ${where}`,
      params
    )
    return Number(rows[0]?.total || 0)
  }

  async list(q: TaskListQuery): Promise<TaskListResult> {
    const params: any[] = []
    let where = ''

    if (q.userRole === 'student') {
      where = 'WHERE t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
      params.push(q.userId)
    } else {
      where = 'WHERE 1=1'
    }

    if (q.search) {
      where += ' AND (t.title LIKE ? OR t.description LIKE ?)'
      params.push(`%${q.search}%`, `%${q.search}%`)
    }

    if (q.status) {
      where += ' AND t.status = ?'
      params.push(q.status)
    }

    const offset = (q.page - 1) * q.limit

    const [rows] = await this.db.query<TaskDTO[]>(
      `SELECT t.*,
              GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', u.email) SEPARATOR '|') AS assigned_users_info
         FROM tasks t
    LEFT JOIN task_assignments ta ON t.id = ta.task_id
    LEFT JOIN users u ON ta.user_id = u.id
       ${where}
     GROUP BY t.id
     ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    const total = await this.countForList(q)
    const tasks: TaskWithAssigned[] = rows.map(this.hydrateAssigned)

    return { tasks, total, page: q.page, limit: q.limit }
  }

  async getForAccess(
    taskId: number,
    userId: number,
    role: 'admin' | 'teacher' | 'student'
  ): Promise<TaskWithAssigned | null> {
    let where = 'WHERE t.id = ?'
    const params: any[] = [taskId]

    if (role === 'student') {
      where += ' AND t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
      params.push(userId)
    }

    const [rows] = await this.db.query<TaskDTO[]>(
      `SELECT t.*,
              GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', u.email) SEPARATOR '|') AS assigned_users_info
         FROM tasks t
    LEFT JOIN task_assignments ta ON t.id = ta.task_id
    LEFT JOIN users u ON ta.user_id = u.id
       ${where}
     GROUP BY t.id`,
      params
    )
    if (!rows.length) return null
    return this.hydrateAssigned(rows[0])
  }

  async insertTask(data: {
    user_id: number
    title: string
    description?: string
    status: string
    start_time?: string
    end_time?: string
    exam_id?: number | null
    type: string
  }): Promise<number> {
    const [ret] = await this.db.query<ResultSetHeader>(
      `INSERT INTO tasks (user_id, title, description, status, start_time, end_time, exam_id, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.title,
        data.description ?? null,
        data.status,
        data.start_time ?? null,
        data.end_time ?? null,
        data.exam_id ?? null,
        data.type,
      ]
    )
    return ret.insertId
  }

  async updateTask(
    taskId: number,
    userScope: { role: 'admin' | 'teacher' | 'student'; userId: number },
    patch: UpdateTaskInput
  ): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []

    if (patch.title !== undefined) {
      fields.push('title = ?')
      values.push(patch.title)
    }
    if (patch.description !== undefined) {
      fields.push('description = ?')
      values.push(patch.description)
    }
    if (patch.status !== undefined) {
      fields.push('status = ?')
      values.push(patch.status)
    }
    if (patch.start_time !== undefined) {
      fields.push('start_time = ?')
      values.push(this.asDateTime(patch.start_time))
    }
    if (patch.end_time !== undefined) {
      fields.push('end_time = ?')
      values.push(this.asDateTime(patch.end_time))
    }

    if (!fields.length) return true
    let where = 'WHERE id = ?'
    const params: any[] = [taskId]

    if (userScope.role === 'student') {
      where += ' AND id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
      params.push(userScope.userId)
    }

    const [ret] = await this.db.query<ResultSetHeader>(
      `UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() ${where}`,
      [...values, ...params]
    )
    return ret.affectedRows > 0
  }

  async deleteTask(
    taskId: number,
    userScope: { role: 'admin' | 'teacher' | 'student'; userId: number }
  ): Promise<boolean> {
    // 权限检查
    const task = await this.getForAccess(taskId, userScope.userId, userScope.role)
    if (!task) return false

    await this.db.query('DELETE FROM task_assignments WHERE task_id = ?', [taskId])
    const [ret] = await this.db.query<ResultSetHeader>('DELETE FROM tasks WHERE id = ?', [taskId])
    return ret.affectedRows > 0
  }

  async replaceAssignments(taskId: number, userIds: number[], assignedBy: number): Promise<void> {
    await this.db.query('DELETE FROM task_assignments WHERE task_id = ?', [taskId])
    if (!userIds.length) return
    const values = userIds.map(uid => [taskId, uid, assignedBy])
    await this.db.query('INSERT INTO task_assignments (task_id, user_id, assigned_by, assigned_at) VALUES ?', [
      values.map(v => [...v, new Date()]),
    ])
  }

  async findExistingUserIds(userIds: number[]): Promise<number[]> {
    if (!userIds.length) return []
    const placeholders = userIds.map(() => '?').join(',')
    const [rows] = await this.db.query<RowDataPacket[]>(`SELECT id FROM users WHERE id IN (${placeholders})`, userIds)
    return rows.map(r => Number(r.id))
  }

  async setStatus(taskId: number, status: 'published' | 'unpublished'): Promise<void> {
    await this.db.query('UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?', [status, taskId])
  }

  async getAssignedUserIds(taskId: number): Promise<number[]> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT user_id FROM task_assignments WHERE task_id = ?', [
      taskId,
    ])
    return rows.map(r => Number(r.user_id))
  }

  async insertNotification(userId: number, title: string, content: string): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (user_id, title, content, type, is_read, created_at)
       VALUES (?, ?, ?, 'task', false, NOW())`,
      [userId, title, content]
    )
  }

  private hydrateAssigned = (row: TaskDTO): TaskWithAssigned => {
    const assigned: { id: number; username: string; email: string }[] = []
    if (row.assigned_users_info) {
      for (const token of row.assigned_users_info.split('|')) {
        const [id, username, email] = token.split(':')
        if (id && username && email) assigned.push({ id: Number(id), username, email })
      }
    }
    const { assigned_users_info, ...rest } = row as any
    return { ...rest, assigned_users: assigned }
  }

  private asDateTime(v?: string | Date): string | null {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
  }
}
