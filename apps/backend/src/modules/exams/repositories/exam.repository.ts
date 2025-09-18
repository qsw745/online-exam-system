// apps/backend/src/modules/exams/repositories/exam.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IExam, IQuestionRow, ExamListData, ExamDetailData } from '../domain/exam.model.js'

export class ExamRepository {
  static async list(params: { page: number; limit: number; status?: string; search?: string }): Promise<ExamListData> {
    const { page, limit, status, search } = params
    const offset = (page - 1) * limit
    const conds: string[] = []
    const vals: any[] = []

    const ALLOWED = new Set(['draft', 'published', 'closed'])
    if (status && ALLOWED.has(status)) {
      conds.push('exams.status = ?') // ← 加表前缀避免歧义
      vals.push(status)
    }
    if (search) {
      conds.push('(exams.title LIKE ? OR exams.description LIKE ?)')
      vals.push(`%${search}%`, `%${search}%`)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const [exams] = await pool.query<RowDataPacket[]>(
        `SELECT *
         FROM exams
                ${where}
         ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        [...vals, limit, offset]
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
        questions?: Array<{ question_id: number }>
      }
  ): Promise<IExam> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [ins] = await conn.query<ResultSetHeader>(
          `INSERT INTO exams (title, description, duration, start_time, end_time, total_score, passing_score, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payload.title,
            payload.description,
            payload.duration,
            payload.start_time,
            payload.end_time,
            payload.total_score,
            payload.passing_score,
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

  static async deleteExam(userId: number, examId: number): Promise<IExam> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [existed] = await conn.query<RowDataPacket[]>(
          'SELECT * FROM exams WHERE id = ? AND created_by = ?',
          [examId, userId]
      )
      if (!(existed as IExam[]).length) throw new Error('考试不存在或无权限删除')

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

      const [qRows] = await conn.query<RowDataPacket[]>(
          `SELECT q.id, q.answer, q.score
           FROM questions q
                  JOIN exam_questions eq ON q.id = eq.question_id
           WHERE eq.exam_id = ?`,
          [examId]
      )
      const questions = (qRows as any[]).map(r => ({ id: r.id as number, answer: r.answer, score: r.score as number }))

      let totalScore = 0
      for (const q of questions) {
        const ua = answers[q.id]
        const correct = ua === q.answer
        if (correct) totalScore += q.score
        await conn.query(
            'INSERT INTO answer_records (exam_result_id, question_id, user_answer, is_correct) VALUES (?, ?, ?, ?)',
            [resultId, q.id, ua, correct]
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
