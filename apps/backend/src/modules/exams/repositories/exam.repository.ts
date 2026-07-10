// apps/backend/src/modules/exams/repositories/exam.repository.ts
import { pool } from '@/config/database.js'
import { isAnswerCorrect } from '../utils/grade.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IExam, IQuestionRow, ExamListData, ExamDetailData } from '../domain/exam.model.js'

export class ExamRepository {
  private static readonly completedResultStatuses = ['completed', 'submitted', 'graded']

  private static completedResultCondition(alias = 'er') {
    const statuses = ExamRepository.completedResultStatuses.map(s => `'${s}'`).join(', ')
    return `(LOWER(COALESCE(${alias}.status, '')) IN (${statuses}) OR ${alias}.submit_time IS NOT NULL)`
  }

  static async countCompletedResults(examId: number, executor: { query: (sql: string, params?: any[]) => Promise<any> } = pool): Promise<number> {
    const [rows] = await executor.query(
        `SELECT COUNT(*) AS cnt
         FROM exam_results er
         WHERE er.exam_id = ?
           AND ${this.completedResultCondition('er')}`,
        [examId]
    )
    return Number((rows?.[0] as any)?.cnt || 0)
  }

  static async list(params: { page: number; limit: number; status?: string; search?: string; userId?: number }): Promise<ExamListData> {
    const { page, limit, status, search, userId } = params
    const offset = (page - 1) * limit
    const conds: string[] = []
    const vals: any[] = []

    const ALLOWED = new Set(['draft', 'reviewing', 'approved', 'published', 'closed', 'rejected'])
    if (status && ALLOWED.has(status)) {
      conds.push('exams.status = ?') // ← 加表前缀避免歧义
      vals.push(status)
    }
    if (search) {
      conds.push('(exams.title LIKE ? OR exams.description LIKE ?)')
      vals.push(`%${search}%`, `%${search}%`)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    // my_status：当前用户对该考试的作答状态（同一考试可能有多条记录时取"最完成"的一条）
    const completedResultExpr = this.completedResultCondition('er')
    const normalizedResultStatusExpr = `CASE
              WHEN LOWER(COALESCE(er.status, '')) IN ('completed','submitted','graded') THEN er.status
              WHEN er.submit_time IS NOT NULL THEN 'completed'
              ELSE er.status
            END`
    const myStatusSelect = userId
      ? `, (SELECT ${normalizedResultStatusExpr} FROM exam_results er
            WHERE er.exam_id = exams.id AND er.user_id = ?
            ORDER BY ${completedResultExpr} DESC, er.id DESC
            LIMIT 1) AS my_status,
          (SELECT er.score FROM exam_results er
            WHERE er.exam_id = exams.id AND er.user_id = ? AND ${completedResultExpr}
            ORDER BY er.submit_time DESC, er.id DESC LIMIT 1) AS my_score,
          (SELECT er.id FROM exam_results er
            WHERE er.exam_id = exams.id AND er.user_id = ? AND ${completedResultExpr}
            ORDER BY er.submit_time DESC, er.id DESC LIMIT 1) AS my_result_id`
      : ''
    const myStatusVals = userId ? [userId, userId, userId] : []

    const [exams] = await pool.query<RowDataPacket[]>(
        `SELECT exams.* ${myStatusSelect}
         FROM exams
                ${where}
         ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        [...myStatusVals, ...vals, limit, offset]
    )

    const [tot] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total
         FROM exams
                ${where}`,
        vals
    )

    return {
      exams: exams as IExam[],
      total: Number((tot[0] as any)?.total || 0),
      page,
      limit,
    }
  }

  static async findById(examId: number): Promise<IExam | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM exams WHERE id = ?', [examId])
    return (rows as IExam[])[0] ?? null
  }

  static async getDetail(examId: number): Promise<ExamDetailData> {
    const exam = await this.findById(examId)
    if (!exam) throw new Error('考试不存在')

    const [qRows] = await pool.query<RowDataPacket[]>(
        `SELECT q.id, q.title, q.content, q.question_type as type, eq.score, q.options
         FROM questions q
                JOIN exam_questions eq ON q.id = eq.question_id
         WHERE eq.exam_id = ?
         ORDER BY eq.question_order`,
        [examId]
    )

    const questions = (qRows as IQuestionRow[]).map(q => ({
      id: q.id,
      title: q.title,
      content: q.content,
      type: q.type,
      score: q.score,
      options: q.options ?? undefined,
    }))

    return { exam, questions }
  }

  static async createExam(
      userId: number,
      payload: {
        title: string
        description: string
        duration: number
        start_time: any
        end_time: any
        total_score: number
        passing_score: number
        workflow_requires_review?: boolean
        workflow_template_id?: number
        workflow_form_data?: Record<string, any> | string
        questions?: Array<{ question_id: number }>
      }
  ): Promise<IExam> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [ins] = await conn.query<ResultSetHeader>(
          `INSERT INTO exams (title, description, duration, start_time, end_time, total_score, passing_score, workflow_requires_review, workflow_template_id, workflow_form_data, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payload.title,
            payload.description,
            payload.duration,
            payload.start_time,
            payload.end_time,
            payload.total_score,
            payload.passing_score,
            payload.workflow_requires_review ? 1 : 0,
            payload.workflow_template_id ?? null,
            payload.workflow_form_data
              ? JSON.stringify(payload.workflow_form_data)
              : null,
            userId,
          ]
      )
      const examId = ins.insertId

      if (Array.isArray(payload.questions) && payload.questions.length) {
        const vals = payload.questions.map((q, i) => [examId, q.question_id, i + 1])
        await conn.query('INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES ?', [vals] as any)
      }

      await conn.commit()
      const [examRows] = await conn.query<RowDataPacket[]>('SELECT * FROM exams WHERE id = ?', [examId])
      return (examRows as IExam[])[0]
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  static async updateExam(
      userId: number,
      examId: number,
      payload: {
        title: string
        description: string
        duration: number
        start_time: any
        end_time: any
        total_score: number
        passing_score: number
        status?: string
        workflow_requires_review?: boolean
        workflow_template_id?: number | null
        workflow_form_data?: Record<string, any> | string | null
        questions?: Array<{ question_id: number }>
      }
  ): Promise<IExam> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [exists] = await conn.query<RowDataPacket[]>(
          'SELECT * FROM exams WHERE id = ? AND created_by = ?',
          [examId, userId]
      )
      if (!(exists as IExam[]).length) throw new Error('考试不存在或无权限修改')

      const fields = [
        'title = ?',
        'description = ?',
        'duration = ?',
        'start_time = ?',
        'end_time = ?',
        'total_score = ?',
        'passing_score = ?',
        typeof payload.status === 'string' ? 'status = ?' : '',
        typeof payload.workflow_requires_review === 'boolean' ? 'workflow_requires_review = ?' : '',
        payload.workflow_template_id !== undefined ? 'workflow_template_id = ?' : '',
        payload.workflow_form_data !== undefined ? 'workflow_form_data = ?' : '',
        'updated_at = NOW()',
      ]
          .filter(Boolean)
          .join(', ')

      const params = [
        payload.title,
        payload.description,
        payload.duration,
        payload.start_time,
        payload.end_time,
        payload.total_score,
        payload.passing_score,
        ...(typeof payload.status === 'string' ? [payload.status] : []),
        ...(typeof payload.workflow_requires_review === 'boolean' ? [payload.workflow_requires_review ? 1 : 0] : []),
        ...(payload.workflow_template_id !== undefined ? [payload.workflow_template_id] : []),
        ...(payload.workflow_form_data !== undefined
          ? [payload.workflow_form_data ? JSON.stringify(payload.workflow_form_data) : null]
          : []),
      ]

      await conn.query(`UPDATE exams SET ${fields} WHERE id = ? AND created_by = ?`, [...params, examId, userId])

      if (Array.isArray(payload.questions)) {
        await conn.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId])
        if (payload.questions.length) {
          const vals = payload.questions.map((q, i) => [examId, q.question_id, i + 1])
          await conn.query('INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES ?', [vals] as any)
        }
      }

      await conn.commit()
      const [exam] = await conn.query<RowDataPacket[]>('SELECT * FROM exams WHERE id = ?', [examId])
      return (exam as IExam[])[0]
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  static async updateWorkflowFields(examId: number, userId: number, config: {
    templateId?: number | null
    formData?: Record<string, any> | string | null
    requiresReview?: boolean
  }) {
    const sets: string[] = []
    const vals: any[] = []
    if (config.templateId !== undefined) {
      sets.push('workflow_template_id = ?')
      vals.push(config.templateId ?? null)
    }
    if (config.formData !== undefined) {
      sets.push('workflow_form_data = ?')
      vals.push(config.formData ? JSON.stringify(config.formData) : null)
    }
    if (typeof config.requiresReview === 'boolean') {
      sets.push('workflow_requires_review = ?')
      vals.push(config.requiresReview ? 1 : 0)
    }
    if (!sets.length) return
    await pool.query(
      `UPDATE exams SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ? AND created_by = ?`,
      [...vals, examId, userId]
    )
  }

  static async updateStatus(examId: number, status: string): Promise<IExam | null> {
    await pool.query<ResultSetHeader>('UPDATE exams SET status = ?, updated_at = NOW() WHERE id = ?', [status, examId])
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM exams WHERE id = ?', [examId])
    return (rows as IExam[])[0] ?? null
  }

  static async deleteExam(userId: number, examId: number): Promise<IExam> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [existed] = await conn.query<RowDataPacket[]>(
          'SELECT * FROM exams WHERE id = ? AND created_by = ?',
          [examId, userId]
      )
      if (!(existed as IExam[]).length) throw new Error('考试不存在或无权限删除')

      const submissionCount = await this.countCompletedResults(examId, conn)
      if (submissionCount > 0) {
        throw new Error(`该考试已有 ${submissionCount} 条交卷记录，不能删除，避免破坏历史成绩。`)
      }

      await conn.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId])
      await conn.query('DELETE FROM exams WHERE id = ?', [examId])

      await conn.commit()
      return (existed as IExam[])[0]
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // —— 开始考试相关 —— //
  static async findPublished(examId: number): Promise<IExam | null> {
    // 现在严格要求已发布
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM exams WHERE id = ? AND status = "published"',
        [examId]
    )
    return (rows as IExam[])[0] ?? null
  }

  static async findAnyInProgressResult(examId: number, userId: number): Promise<RowDataPacket | null> {
    const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM exam_results WHERE exam_id = ? AND user_id = ? AND status != "submitted"',
        [examId, userId]
    )
    return existing[0] ?? null
  }

  static async createInProgressResult(examId: number, userId: number): Promise<void> {
    await pool.query(
        'INSERT INTO exam_results (exam_id, user_id, start_time, status) VALUES (?, ?, NOW(), "in_progress")',
        [examId, userId]
    )
  }

  static async submitAndScore(
      examId: number,
      userId: number,
      answers: Record<number, any>
  ): Promise<{ resultId: number; questions: Array<{ id: number; answer: any; score: number }>; totalScore: number }> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [results] = await conn.query<RowDataPacket[]>(
          'SELECT * FROM exam_results WHERE exam_id = ? AND user_id = ? AND status = "in_progress"',
          [examId, userId]
      )
      if (!results.length) throw new Error('未找到进行中的考试')
      const resultId = (results[0] as any).id as number

      // 经试卷取题判分：exam_questions 表并不存在，考试题目走 exams.paper_id → paper_questions
      const [qRows] = await conn.query<RowDataPacket[]>(
          `SELECT q.id, q.question_type, q.correct_answer, q.options, pq.score AS pq_score
           FROM exams e
                  JOIN paper_questions pq ON pq.paper_id = e.paper_id
                  JOIN questions q ON q.id = pq.question_id
           WHERE e.id = ?
           ORDER BY pq.\`order\` ASC`,
          [examId]
      )
      const questions = (qRows as any[]).map(r => ({
        id: r.id as number,
        question_type: String(r.question_type ?? ''),
        correct_answer: String(r.correct_answer ?? ''),
        options: r.options,
        answer: r.correct_answer,
        score: Number(r.pq_score || 0),
      }))

      let totalScore = 0
      for (const q of questions) {
        const ua = answers[q.id]
        // 统一判分：兼容 字母/内容/数组/判断题 等提交与存储格式
        const correct = isAnswerCorrect(q, ua)
        if (correct) totalScore += q.score
        await conn.query(
            'INSERT INTO answer_records (exam_result_id, exam_id, user_id, question_id, user_answer, is_correct) VALUES (?, ?, ?, ?, ?, ?)',
            [resultId, examId, userId, q.id, ua ?? '', correct]
        )
      }

      await conn.query(
          'UPDATE exam_results SET score = ?, submit_time = NOW(), status = "submitted", answers = ? WHERE id = ?',
          [totalScore, JSON.stringify(answers), resultId]
      )

      await conn.commit()
      return { resultId, questions, totalScore }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}
