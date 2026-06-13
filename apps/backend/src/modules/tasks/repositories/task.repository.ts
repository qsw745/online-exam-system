/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool as basePool } from '@/config/database.js'
import type { TaskDTO, TaskListQuery, TaskListResult, TaskWithAssigned, UpdateTaskInput } from '../domain/task.model.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

// ---- 最小接口，屏蔽 mysql2 类型差异 ----
interface DBConn {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}
interface DBPool {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
  getConnection(): Promise<DBConn>
}
const pool = basePool as unknown as DBPool

// ================== helpers (module-scope) ==================
function formatNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}
function parseOptionsLoose(input: any): string[] | null {
  const toLabel = (x: any) => (x == null ? '' : typeof x === 'string' ? x : x?.content ?? x?.label ?? String(x))
  if (input == null) return null
  if (Array.isArray(input)) {
    const arr = input
      .map(toLabel)
      .map(s => String(s).trim())
      .filter(Boolean)
    return arr.length ? arr : null
  }
  let s = String(input).trim()
  if (!s) return null
  try {
    const v = JSON.parse(s)
    if (Array.isArray(v)) {
      const arr = v
        .map(toLabel)
        .map((x: string) => x.trim())
        .filter(Boolean)
      if (arr.length) return arr
    }
  } catch {}
  try {
    const fixed = s.replace(/'/g, '"')
    const v = JSON.parse(fixed)
    if (Array.isArray(v)) {
      const arr = v
        .map(toLabel)
        .map((x: string) => x.trim())
        .filter(Boolean)
      if (arr.length) return arr
    }
  } catch {}
  const parts = s
    .split(/\r?\n|[|,;，、]\s*/g)
    .map(x => x.trim())
    .filter(Boolean)
  return parts.length ? parts : null
}
function normalizeOptions(qType: string, raw: any): string[] | null {
  const t = String(qType || '').toLowerCase()
  if (['true_false', 'judge', 'tf'].includes(t)) return ['正确', '错误']
  return parseOptionsLoose(raw)
}

// ================== repository ==================
export class TaskRepository {
  constructor(private readonly db: DBPool = pool) {}

  // ------- 小工具：缓存列探测，避免频繁 information_schema 查询 -------
  private __colCache = new Map<string, boolean>()
  private async hasColumn(table: string, col: string, executor?: DBPool | DBConn): Promise<boolean> {
    const key = `${table}.${col}`
    if (this.__colCache.has(key)) return this.__colCache.get(key)!
    const runner = (executor as DBPool) ?? this.db
    const [rows] = await runner.execute<RowDataPacket[]>(
      `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      [table, col]
    )
    const ok = Array.isArray(rows) && rows.length > 0
    this.__colCache.set(key, ok)
    return ok
  }

  /** 用新的部门ID集合替换（覆盖） */
  async replaceDepartmentAssignments(taskId: number, departmentIds: number[], assignedBy: number): Promise<void> {
    await this.db.execute('DELETE FROM task_department_assignments WHERE task_id = ?', [taskId])
    const ids = Array.from(new Set(departmentIds.filter(n => Number.isFinite(n) && n > 0)))
    if (!ids.length) return
    const rows = ids.map(id => [taskId, id, assignedBy, new Date()])
    const placeholders = rows.map(() => '(?, ?, ?, ?)').join(', ')
    await this.db.execute(
      `INSERT INTO task_department_assignments (task_id, department_id, assigned_by, assigned_at) VALUES ${placeholders}`,
      rows.flat()
    )
  }

  async getAssignedDepartmentIds(taskId: number): Promise<number[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT department_id FROM task_department_assignments WHERE task_id = ?',
      [taskId]
    )
    return rows.map((r: any) => Number(r.department_id))
  }

  /** 返回 [{id,name}]，供 hydrate */
  async getAssignedDepartments(taskId: number): Promise<Array<{ id: number; name: string }>> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT o.id, o.name
         FROM task_department_assignments tda
         JOIN organizations o ON o.id = tda.department_id
        WHERE tda.task_id = ?`,
      [taskId]
    )
    return rows.map((r: any) => ({ id: Number(r.id), name: String(r.name ?? '') }))
  }

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

    if (q.startFrom) {
      where += ' AND COALESCE(t.start_time, t.created_at) >= ?'
      params.push(q.startFrom)
    }

    if (q.endTo) {
      where += ' AND COALESCE(t.end_time, t.start_time, t.created_at) <= ?'
      params.push(q.endTo)
    }

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT t.id) AS total
         FROM tasks t
         LEFT JOIN task_assignments ta ON t.id = ta.task_id
         LEFT JOIN users u ON ta.user_id = u.id
       ${where}`,
      params
    )
    return Number((rows[0] as any)?.total || 0)
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

    if (q.startFrom) {
      where += ' AND COALESCE(t.start_time, t.created_at) >= ?'
      params.push(q.startFrom)
    }

    if (q.endTo) {
      where += ' AND COALESCE(t.end_time, t.start_time, t.created_at) <= ?'
      params.push(q.endTo)
    }

    // ✅ 关键修复：不要在 PREPARE 里用 LIMIT ? / OFFSET ?
    // 统一转为安全数字后内联，避免 ER_WRONG_ARGUMENTS
    const safeLimit = Math.max(1, Math.min(1000, Number(q.limit) || 10))
    const safeOffset = Math.max(0, Number((q.page - 1) * q.limit) || 0)

    const sql = `
      SELECT
         t.*,
         e.id        AS exam_id,
         e.paper_id  AS paper_id,
         p.title     AS paper_title,
         GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', u.email) SEPARATOR '|') AS assigned_users_info,
         GROUP_CONCAT(DISTINCT CONCAT(o.id, ':', o.name) SEPARATOR '|') AS assigned_departments_info
       FROM tasks t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN papers p ON p.id = e.paper_id
       LEFT JOIN task_assignments ta ON t.id = ta.task_id
       LEFT JOIN users u ON ta.user_id = u.id
       LEFT JOIN task_department_assignments tda ON tda.task_id = t.id
       LEFT JOIN organizations o ON o.id = tda.department_id
       ${where}
       GROUP BY t.id
       ORDER BY t.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}
    `

    const [rows] = await this.db.execute<(TaskDTO & RowDataPacket)[]>(sql, params)

    const total = await this.countForList(q)
    const tasks: TaskWithAssigned[] = rows.map(r => this.hydrateAssigned(r as any))
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

    const [rows] = await this.db.execute<(TaskDTO & RowDataPacket)[]>(
      `SELECT
         t.*,
         e.id        AS exam_id,
         e.paper_id  AS paper_id,
         p.title     AS paper_title,
         GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', u.email) SEPARATOR '|') AS assigned_users_info,
         GROUP_CONCAT(DISTINCT CONCAT(o.id, ':', o.name) SEPARATOR '|') AS assigned_departments_info
       FROM tasks t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN papers p ON p.id = e.paper_id
       LEFT JOIN task_assignments ta ON t.id = ta.task_id
       LEFT JOIN users u ON ta.user_id = u.id
       LEFT JOIN task_department_assignments tda ON tda.task_id = t.id
       LEFT JOIN organizations o ON o.id = tda.department_id
       ${where}
       GROUP BY t.id`,
      params
    )
    if (!rows.length) return null
    return this.hydrateAssigned(rows[0] as any)
  }

  /** 通过 examId + userId 找该学生收到的 taskId */
  async findTaskIdByExamForUser(examId: number, userId: number): Promise<number | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT t.id
         FROM tasks t
         JOIN task_assignments ta ON ta.task_id = t.id
        WHERE t.exam_id = ? AND ta.user_id = ?
        LIMIT 1`,
      [examId, userId]
    )
    return rows.length ? Number((rows[0] as any).id) : null
  }

  /** 老师/管理员：找任意与该考试关联的 taskId */
  async findAnyTaskIdByExam(examId: number): Promise<number | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM tasks WHERE exam_id = ? LIMIT 1`, [examId])
    return rows.length ? Number((rows[0] as any).id) : null
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
    const [ret] = await this.db.execute<ResultSetHeader>(
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
    if (patch.exam_id !== undefined) {
      fields.push('exam_id = ?')
      values.push(patch.exam_id ?? null)
    }
    if (patch.type !== undefined) {
      fields.push('type = ?')
      values.push(patch.type)
    }

    if (!fields.length) return true
    let where = 'WHERE id = ?'
    const params: any[] = [taskId]

    if (userScope.role === 'student') {
      where += ' AND id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
      params.push(userScope.userId)
    }

    const [ret] = await this.db.execute<ResultSetHeader>(
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
    await this.db.execute('DELETE FROM task_assignments WHERE task_id = ?', [taskId])
    const [ret] = await this.db.execute<ResultSetHeader>('DELETE FROM tasks WHERE id = ?', [taskId])
    return ret.affectedRows > 0
  }

  async replaceAssignments(taskId: number, userIds: number[], assignedBy: number): Promise<void> {
    await this.db.execute('DELETE FROM task_assignments WHERE task_id = ?', [taskId])
    if (!userIds.length) return
    const rows = userIds.map(uid => [taskId, uid, assignedBy, new Date()])
    const placeholders = rows.map(() => '(?, ?, ?, ?)').join(', ')
    const flatValues = rows.flat()
    await this.db.execute(
      `INSERT INTO task_assignments (task_id, user_id, assigned_by, assigned_at) VALUES ${placeholders}`,
      flatValues
    )
  }

  async findExistingUserIds(userIds: number[]): Promise<number[]> {
    if (!userIds.length) return []
    const placeholders = userIds.map(() => '?').join(',')
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM users WHERE id IN (${placeholders})`, userIds)
    return rows.map((r: any) => Number(r.id))
  }

  async listAllUserIds(): Promise<number[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(`SELECT id FROM users`)
    return rows.map((r: any) => Number(r.id))
  }

  async setStatus(taskId: number, status: 'published' | 'unpublished'): Promise<void> {
    await this.db.execute('UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?', [status, taskId])
  }

  async getAssignedUserIds(taskId: number): Promise<number[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>('SELECT user_id FROM task_assignments WHERE task_id = ?', [
      taskId,
    ])
    return rows.map((r: any) => Number(r.user_id))
  }

  /** 部门 → 用户 */
  async findUserIdsByDepartmentIds(deptIds: number[]): Promise<number[]> {
    if (!deptIds.length) return []
    const placeholders = deptIds.map(() => '?').join(',')
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT DISTINCT uo.user_id
         FROM user_organizations uo
        WHERE uo.org_id IN (${placeholders})`,
      deptIds
    )
    return rows.map((r: any) => Number(r.user_id))
  }

  /** 考试：更新试卷 */
  async updateExamPaper(examId: number, paperId: number): Promise<void> {
    await this.db.execute('UPDATE exams SET paper_id = ?, updated_at = NOW() WHERE id = ?', [paperId, examId])
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
    const [ret] = await this.db.execute<ResultSetHeader>(
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

  /** ---------- 获取考试 Meta（给服务层 getExam 用） ---------- */
  async getExamMetaByTask(taskId: number): Promise<{
    taskId: number
    type: string
    exam_id: number | null
    paper_id: number | null
    duration: number | null
    start_time: string | null
    end_time: string | null
    title: string
    description: string | null
  } | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `
      SELECT
        t.id AS taskId,
        t.type AS task_type,
        e.id AS exam_id,
        e.paper_id AS paper_id,
        e.duration AS duration,
        DATE_FORMAT(COALESCE(e.start_time, t.start_time), '%Y-%m-%d %H:%i:%s') AS start_time,
        DATE_FORMAT(COALESCE(e.end_time,   t.end_time),   '%Y-%m-%d %H:%i:%s') AS end_time,
        COALESCE(e.title, t.title) AS title,
        COALESCE(e.description, t.description) AS description
      FROM tasks t
      LEFT JOIN exams e ON e.id = t.exam_id
      WHERE t.id = ?
      LIMIT 1
      `,
      [taskId]
    )
    if (!rows.length) return null
    const r: any = rows[0]
    return {
      taskId: Number(r.taskId),
      type: String(r.task_type || ''),
      exam_id: r.exam_id == null ? null : Number(r.exam_id),
      paper_id: r.paper_id == null ? null : Number(r.paper_id),
      duration: r.duration == null ? null : Number(r.duration),
      start_time: r.start_time ?? null,
      end_time: r.end_time ?? null,
      title: String(r.title ?? ''),
      description: r.description == null ? null : String(r.description),
    }
  }

  /** ---------- 获取考试 payload（题目不含正确答案） ---------- */
  async getQuestionsViewByPaperId(
    paperId: number,
    conn?: DBConn
  ): Promise<Array<{ id: number; type: string; content: string; options: any; score: number; order: number }>> {
    const executor = conn ?? this.db

    const hasCol = async (table: string, col: string) => {
      ;(this as any).__colCache ??= new Map<string, boolean>()
      const cache: Map<string, boolean> = (this as any).__colCache
      const key = `${table}.${col}`
      if (cache.has(key)) return cache.get(key)!
      const [rows] = await executor.execute<RowDataPacket[]>(
        `SELECT 1
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
          LIMIT 1`,
        [table, col]
      )
      const ok = Array.isArray(rows) && rows.length > 0
      cache.set(key, ok)
      return ok
    }

    const hasPQType = await hasCol('paper_questions', 'question_type')
    const hasPQContent = await hasCol('paper_questions', 'question_content')
    const hasPQOptions = await hasCol('paper_questions', 'question_options')

    const selects = [
      'pq.question_id          AS pq_qid',
      'pq.score                AS pq_score',
      'pq.`order`              AS pq_order',
      'q.id                    AS q_id',
      'q.question_type         AS q_type',
      'q.content               AS q_content',
      'q.options               AS q_options',
    ]
    if (hasPQType) selects.push('pq.question_type    AS pq_type')
    if (hasPQContent) selects.push('pq.question_content AS pq_content')
    if (hasPQOptions) selects.push('pq.question_options AS pq_options')

    const sql = `
      SELECT ${selects.join(', ')}
        FROM paper_questions pq
        LEFT JOIN questions q ON q.id = pq.question_id
       WHERE pq.paper_id = ?
       ORDER BY pq.\`order\` ASC
    `

    const [rows] = await executor.execute<RowDataPacket[]>(sql, [paperId])

    const stdType = (t?: string) => {
      const s = String(t || '').toLowerCase()
      if (['single', 'single_choice', 'radio', 'sc'].includes(s)) return 'single_choice'
      if (['multiple', 'multiple_choice', 'checkbox', 'mc'].includes(s)) return 'multiple_choice'
      if (['true_false', 'judge', 'tf'].includes(s)) return 'true_false'
      if (['short', 'short_answer', 'essay', 'text', 'fill_blank'].includes(s)) return 'short_answer'
      return s || 'single_choice'
    }

    return rows.map((r: any) => {
      const id = Number(r.q_id ?? r.pq_qid)
      const type = stdType(r.q_type ?? r.pq_type ?? 'single_choice')
      const content = String(r.q_content ?? r.pq_content ?? '')
      const rawOpts = r.q_options ?? r.pq_options ?? null
      const score = Number(r.pq_score || 0)
      const order = Number(r.pq_order || 0)
      const opts = normalizeOptions(type, rawOpts)
      return { id, type, content, options: type === 'short_answer' ? null : opts ?? [], score, order }
    })
  }

  /** exam_results 取或建（非事务版本，方便 getExam 调用） */
  async ensureExamResultStandalone(
    examId: number,
    userId: number
  ): Promise<{ id: number; status: 'in_progress' | 'submitted'; start_time: string | null }> {
    const [exists] = await this.db.execute<RowDataPacket[]>(
      'SELECT id, status, DATE_FORMAT(start_time, "%Y-%m-%d %H:%i:%s") AS start_time FROM exam_results WHERE exam_id = ? AND user_id = ?',
      [examId, userId]
    )
    if (exists.length) {
      const row: any = exists[0]
      if (!row.start_time) {
        await this.db.execute('UPDATE exam_results SET status = "in_progress", start_time = NOW() WHERE id = ?', [
          row.id,
        ])
        return { id: Number(row.id), status: 'in_progress', start_time: formatNow() }
      }
      return { id: Number(row.id), status: (row.status as any) ?? 'in_progress', start_time: row.start_time ?? null }
    }
    const [ret] = await this.db.execute<ResultSetHeader>(
      'INSERT INTO exam_results (exam_id, user_id, status, start_time, created_at, updated_at) VALUES (?, ?, "in_progress", NOW(), NOW(), NOW())',
      [examId, userId]
    )
    return { id: ret.insertId, status: 'in_progress', start_time: formatNow() }
  }

  /** ---------- 提交与评分（事务） ---------- */
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

      // 1) 取试卷
      const paperId = await this.getPaperIdByExamId(args.examId, conn)
      if (!paperId) throw new Error('考试未关联试卷')

      // 2) 确保 exam_results 存在
      const examResultId = await this.ensureExamResult(args.examId, args.userId, conn)

      // 3) 判分用题目（只要 id / correct_answer / score）
      const questions = await this.getQuestionsForGradingByPaperId(paperId, conn)

      let totalScore = 0
      let correctCount = 0

      // 4) 仅插入通用 4 列（无 subject）
      const values: any[][] = []
      for (const row of questions) {
        const qid = Number(row.id)
        const qScore = Number(row.score || 0)
        const ua = (args.answers as any)?.[qid]
        const ok = ua === row.correct_answer
        if (ok) {
          totalScore += qScore
          correctCount += 1
        }
        values.push([examResultId, args.examId, args.userId, qid, ua ?? '', ok ? 1 : 0])
      }

      await conn.execute('DELETE FROM answer_records WHERE exam_result_id = ?', [examResultId])
      if (values.length) {
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
        await conn.execute(
          `INSERT INTO answer_records (exam_result_id, exam_id, user_id, question_id, user_answer, is_correct) VALUES ${placeholders}`,
          values.flat()
        )
      }

      await conn.execute(
        'UPDATE exam_results SET score = ?, submit_time = NOW(), status = "submitted", answers = ?, time_spent = ? WHERE id = ?',
        [totalScore, JSON.stringify(args.answers || {}), args.time_spent || 0, examResultId]
      )
      // 不要在单个用户提交后把任务标记为全局 completed，避免其他用户无法继续考试

      await conn.commit()
      return { score: totalScore, correctCount, questionCount: questions.length, examResultId }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // ---------- 事务内工具 ----------
  private async getPaperIdByExamId(examId: number, conn: DBConn): Promise<number | null> {
    const [rows] = await conn.execute<RowDataPacket[]>('SELECT paper_id FROM exams WHERE id = ?', [examId])
    if (!rows.length) return null
    return (rows[0] as any).paper_id ? Number((rows[0] as any).paper_id) : null
  }

  private async ensureExamResult(examId: number, userId: number, conn: DBConn): Promise<number> {
    const [exists] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM exam_results WHERE exam_id = ? AND user_id = ?',
      [examId, userId]
    )
    if (exists.length) return Number((exists[0] as any).id)
    const [ret] = await conn.execute<ResultSetHeader>(
      'INSERT INTO exam_results (exam_id, user_id, status, start_time) VALUES (?, ?, "in_progress", NOW())',
      [examId, userId]
    )
    return ret.insertId
  }

  /** 获取判分用题目（带正确答案/分值；不含 subject） */
  private async getQuestionsForGradingByPaperId(
    paperId: number,
    conn: DBConn
  ): Promise<Array<{ id: number; correct_answer: string; score: number }>> {
    const sql = `
      SELECT q.id             AS q_id,
             q.correct_answer AS correct_answer,
             pq.score         AS pq_score
        FROM paper_questions pq
        JOIN questions q ON q.id = pq.question_id
       WHERE pq.paper_id = ?
       ORDER BY pq.\`order\` ASC
    `
    const [qs] = await conn.execute<RowDataPacket[]>(sql, [paperId])
    return (qs as any[]).map(r => ({
      id: Number(r.q_id),
      correct_answer: String(r.correct_answer ?? ''),
      score: Number(r.pq_score || 0),
    }))
  }

  /** ---------- 通知 & 工具 ---------- */
  async insertNotification(userId: number, title: string, content: string, targetPath?: string | null): Promise<void> {
    await this.db.execute(
      `INSERT INTO notifications (user_id, title, content, type, is_read, created_at, source, target_path, metadata)
       VALUES (?, ?, ?, 'task', false, NOW(), 'tasks', ?, NULL)`,
      [userId, title, content, targetPath ?? null]
    )
  }

  private hydrateAssigned = (row: TaskDTO): TaskWithAssigned => {
    const assignedUsers: { id: number; username: string; email: string }[] = []
    if ((row as any).assigned_users_info) {
      for (const token of String((row as any).assigned_users_info).split('|')) {
        const [id, username, email] = token.split(':')
        if (id && username && email) assignedUsers.push({ id: Number(id), username, email })
      }
    }

    const assignedDepartments: { id: number; name: string }[] = []
    if ((row as any).assigned_departments_info) {
      for (const token of String((row as any).assigned_departments_info).split('|')) {
        const [id, name] = token.split(':')
        if (id && name) assignedDepartments.push({ id: Number(id), name })
      }
    }

    const { assigned_users_info, assigned_departments_info, ...rest } = row as any
    return {
      ...rest,
      assigned_users: assignedUsers,
      assigned_departments: assignedDepartments,
      assigned_department_ids: assignedDepartments.map(d => d.id),
    }
  }

  private asDateTime(v?: string | Date | null): string | null {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
  }
}
