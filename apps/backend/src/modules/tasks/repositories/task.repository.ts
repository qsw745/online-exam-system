import type { Pool, ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise'
import { pool } from '@/config/database.js'
import type {
  TaskDTO,
  TaskListQuery,
  TaskListResult,
  TaskWithAssigned,
  UpdateTaskInput,
} from '../domain/task.entity.js'

export class TaskRepository {
  constructor(private readonly db: Pool = pool) {}

  /** ---------- 列表/详情 ---------- */
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

  /** ---------- 任务写操作 ---------- */
  async insertTask(data: {
    user_id: number
    title: string
    description?: string
    status: string
    start_time?: string | null
    end_time?: string | null
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

  /** ---------- 新增：部门 → 用户展开 ---------- */
  async findUserIdsByDepartmentIds(deptIds: number[]): Promise<number[]> {
    if (!deptIds.length) return []
    const placeholders = deptIds.map(() => '?').join(',')
    // 根据你的表结构适配此查询
    const [rows] = await this.db.query<RowDataPacket[]>(
        `SELECT id FROM users WHERE department_id IN (${placeholders})`,
        deptIds
    )
    return rows.map(r => Number(r.id))
  }

  /** ---------- 新增：考试管理 SQL ---------- */
  async updateExamPaper(examId: number, paperId: number): Promise<void> {
    await this.db.query('UPDATE exams SET paper_id = ?, updated_at = NOW() WHERE id = ?', [paperId, examId])
  }

  async createExam(data: {
    title: string
    description?: string
    paper_id?: number | null
    duration?: number
    start_time?: string | Date | null
    end_time?: string | Date | null
    created_by: number
  }): Promise<number> {
    const [ret] = await this.db.query<ResultSetHeader>(
        'INSERT INTO exams (title, description, paper_id, duration, start_time, end_time, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [
          data.title,
          data.description ?? '',
          data.paper_id ?? null,
          data.duration ?? 60,
          this.asDateTime(data.start_time),
          this.asDateTime(data.end_time),
          data.created_by,
        ]
    )
    return ret.insertId
  }

  /** ---------- 新增：提交与评分（事务） ---------- */
  async submitAndGrade(args: {
    examId: number
    userId: number
    answers: Record<string, string>
    time_spent: number
    taskId: number
  }): Promise<{ score: number; correctCount: number; questionCount: number; examResultId: number }> {
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()

      // 读取考试及试卷
      const paperId = await this.getPaperIdByExamId(args.examId, conn)
      if (!paperId) throw new Error('考试未关联试卷')

      // exam_results 取或建
      const examResultId = await this.ensureExamResult(args.examId, args.userId, conn)

      // 取题（按顺序）
      const questions = await this.getQuestionsByPaperId(paperId, conn)

      // 判分
      let totalScore = 0
      let correctCount = 0
      const values: Array<[number, number, string, number]> = []

      for (const row of questions) {
        const qid = Number(row.id)
        const ua = args.answers?.[qid]
        const ok = ua === row.correct_answer
        if (ok) {
          totalScore += Number(row.score || 0)
          correctCount += 1
        }
        values.push([examResultId, qid, ua ?? '', ok ? 1 : 0])
      }

      // 覆盖写入答案
      await conn.query('DELETE FROM answer_records WHERE exam_result_id = ?', [examResultId])
      if (values.length) {
        await conn.query(
            'INSERT INTO answer_records (exam_result_id, question_id, user_answer, is_correct) VALUES ?',
            [values]
        )
      }

      await conn.query(
          'UPDATE exam_results SET score = ?, submit_time = NOW(), status = "submitted", answers = ?, time_spent = ? WHERE id = ?',
          [totalScore, JSON.stringify(args.answers || {}), args.time_spent || 0, examResultId]
      )
      await conn.query('UPDATE tasks SET status = "completed" WHERE id = ?', [args.taskId])

      await conn.commit()
      return { score: totalScore, correctCount, questionCount: questions.length, examResultId }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  /** 辅助：通过 examId 拿 paperId（需在事务连接上执行） */
  private async getPaperIdByExamId(examId: number, conn: PoolConnection): Promise<number | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT paper_id FROM exams WHERE id = ?', [examId])
    if (!rows.length) return null
    return rows[0].paper_id ? Number(rows[0].paper_id) : null
  }

  /** 辅助：确保 exam_results 存在，返回 id */
  private async ensureExamResult(examId: number, userId: number, conn: PoolConnection): Promise<number> {
    const [exists] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM exam_results WHERE exam_id = ? AND user_id = ?',
        [examId, userId]
    )
    if (exists.length) return Number(exists[0].id)
    const [ret] = await conn.query<ResultSetHeader>(
        'INSERT INTO exam_results (exam_id, user_id, status, start_time) VALUES (?, ?, "in_progress", NOW())',
        [examId, userId]
    )
    return ret.insertId
  }

  /** 辅助：按试卷取题与分值（顺序） */
  private async getQuestionsByPaperId(
      paperId: number,
      conn: PoolConnection
  ): Promise<Array<{ id: number; correct_answer: string; score: number }>> {
    const [qs] = await conn.query<RowDataPacket[]>(
        `SELECT q.id, q.correct_answer, pq.score
         FROM paper_questions pq
         JOIN questions q ON q.id = pq.question_id
        WHERE pq.paper_id = ?
        ORDER BY pq.\`order\` ASC`,
        [paperId]
    )
    return qs.map(r => ({ id: Number(r.id), correct_answer: String(r.correct_answer ?? ''), score: Number(r.score || 0) }))
  }

  /** ---------- 工具 ---------- */
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

  private asDateTime(v?: string | Date | null): string | null {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
  }
}
