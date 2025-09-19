// src/modules/exams/repositories/paper.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  IPaper,
  IPaperQuestion,
  PaperData,
  PaperListData,
  PaperQuestionData,
  IQuestion,
} from '../domain/paper.model.js'

export class PaperRepository {
  static async addQuestion(paperId: number, data: { questionId: number; score: number; order: number }) {
    const [rs] = await pool.query<ResultSetHeader>(
        'INSERT INTO paper_questions (paper_id, question_id, score, `order`) VALUES (?, ?, ?, ?)',
        [paperId, Number(data.questionId), data.score, data.order]
    )
    return { questionId: rs.insertId }
  }

  static async removeQuestion(paperId: number, questionId: number) {
    const [rs] = await pool.query<ResultSetHeader>(
        'DELETE FROM paper_questions WHERE paper_id = ? AND question_id = ?',
        [paperId, questionId]
    )
    return rs.affectedRows
  }

  /** 👉 加上 q.difficulty 作为 question_difficulty 返回 */
  static async getQuestions(paperId: number): Promise<PaperQuestionData> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT pq.*,
              q.title          AS question_title,
              q.question_type  AS question_type,
              q.content        AS question_content,
              q.options        AS question_options,
              q.correct_answer AS question_answer,
              q.difficulty     AS question_difficulty
       FROM paper_questions pq
       JOIN questions q ON pq.question_id = q.id
       WHERE pq.paper_id = ?
       ORDER BY pq.\`order\` ASC`,
        [paperId]
    )
    return { questions: rows as unknown as IPaperQuestion[] }
  }

  static async updateOrder(paperId: number, orders: Array<{ questionId: number; order: number }>) {
    await Promise.all(
        orders.map(({ questionId, order }) =>
            pool.query('UPDATE paper_questions SET `order` = ? WHERE paper_id = ? AND question_id = ?', [
              order,
              paperId,
              questionId,
            ])
        )
    )
  }

  static async list(params: {
    difficulty?: 'easy' | 'medium' | 'hard'
    limit: number
    offset: number
  }): Promise<PaperListData> {
    const { difficulty, limit, offset } = params
    const conds: string[] = []
    const vals: any[] = []
    if (difficulty) {
      conds.push('difficulty = ?')
      vals.push(difficulty)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const [papers] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM papers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...vals, limit, offset]
    )
    const [totalRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM papers ${where}`, vals)
    return { papers: papers as IPaper[], total: Number((totalRows[0] as any)?.total || 0) }
  }

  static async findById(paperId: number): Promise<PaperData> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM papers WHERE id = ?', [paperId])
    if (!rows.length) throw new Error('试卷不存在')
    return { paper: (rows as IPaper[])[0] }
  }

  static async create(body: {
    title: string
    description: string
    difficulty: 'easy' | 'medium' | 'hard'
    total_score: number
    duration: number
  }): Promise<PaperData> {
    const [ins] = await pool.query<ResultSetHeader>(
        'INSERT INTO papers (title, description, difficulty, total_score, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [body.title, body.description, body.difficulty, body.total_score, body.duration]
    )
    const [paper] = await pool.query<RowDataPacket[]>('SELECT * FROM papers WHERE id = ?', [ins.insertId])
    return { paper: (paper as IPaper[])[0] }
  }

  static async update(
      paperId: number,
      body: {
        title: string
        description: string
        difficulty: 'easy' | 'medium' | 'hard'
        total_score: number
        duration: number
      }
  ): Promise<PaperData> {
    const [rs] = await pool.query<ResultSetHeader>(
        'UPDATE papers SET title = ?, description = ?, difficulty = ?, total_score = ?, duration = ?, updated_at = NOW() WHERE id = ?',
        [body.title, body.description, body.difficulty, body.total_score, body.duration, paperId]
    )
    if (rs.affectedRows === 0) throw new Error('试卷不存在')
    const [paper] = await pool.query<RowDataPacket[]>('SELECT * FROM papers WHERE id = ?', [paperId])
    return { paper: (paper as IPaper[])[0] }
  }

  static async remove(paperId: number) {
    const [rs] = await pool.query<ResultSetHeader>('DELETE FROM papers WHERE id = ?', [paperId])
    if (rs.affectedRows === 0) throw new Error('试卷不存在')
  }

  static async createWithQuestions(body: {
    title: string
    description: string
    duration: number
    difficulty: 'easy' | 'medium' | 'hard'
    total_score: number
    questions?: Array<{ question_id: number; score: number; order: number }>
  }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [paperResult] = (await conn.execute(
          'INSERT INTO papers (title, description, difficulty, total_score, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [body.title, body.description, body.difficulty, body.total_score, body.duration]
      )) as [ResultSetHeader, any]
      const paperId = paperResult.insertId
      if (body.questions?.length) {
        const values = body.questions.map(q => [paperId, q.question_id, q.score, q.order])
        await conn.query('INSERT INTO paper_questions (paper_id, question_id, score, `order`) VALUES ?', [values])
      }
      await conn.commit()
      return { paperId, message: '试卷创建成功' }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  static async findRandomQuestions(params: {
    types?: string[]
    difficulty?: 'easy' | 'medium' | 'hard'
    limit: number
  }): Promise<IQuestion[]> {
    const conds: string[] = []
    const vals: any[] = []
    if (params.types?.length) {
      conds.push('question_type IN (?)')
      vals.push(params.types)
    }
    if (params.difficulty) {
      conds.push('difficulty = ?')
      vals.push(params.difficulty)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const sql = `SELECT id, title, question_type, difficulty FROM questions ${where} ORDER BY RAND() LIMIT ?`
    vals.push(params.limit)
    const [rows] = await pool.query<RowDataPacket[]>(sql, vals)
    return rows as unknown as IQuestion[]
  }

  static async createPaperAndAttachQuestions(body: {
    title: string
    description: string
    difficulty: 'easy' | 'medium' | 'hard'
    duration: number
    total_score: number
    questions: Array<{ question_id: number; score: number; order: number }>
  }) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [paperIns] = (await conn.execute(
          'INSERT INTO papers (title, description, difficulty, total_score, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [body.title, body.description, body.difficulty, body.total_score, body.duration]
      )) as [ResultSetHeader, any]
      const paperId = paperIns.insertId

      if (body.questions?.length) {
        const values = body.questions.map(q => [paperId, q.question_id, q.score, q.order])
        await conn.query('INSERT INTO paper_questions (paper_id, question_id, score, `order`) VALUES ?', [values])
      }

      await conn.commit()
      return { paperId }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }
}
