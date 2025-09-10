// apps/backend/src/modules/wrong-questions/repositories/wq.repository.ts
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '@/config/database.js'
import type { MasteryLevel, PracticeRecord, WrongQuestion, WrongQuestionBook } from '../domain/wq.entity.js'

export class WrongQuestionRepository {
  constructor(private readonly db: Pool = pool) {}

  // books
  async createBook(b: Omit<WrongQuestionBook, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const [ret] = await this.db.query<ResultSetHeader>(
      `INSERT INTO wrong_question_books (user_id, name, description, is_default, is_public)
       VALUES (?, ?, ?, ?, ?)`,
      [b.user_id, b.name, b.description || '', b.is_default, b.is_public]
    )
    return ret.insertId
  }

  async getBooksWithStats(userId: number) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT wqb.*,
              COUNT(wq.id) AS question_count,
              COUNT(CASE WHEN wq.mastery_level='mastered' THEN 1 END) AS mastered_count
         FROM wrong_question_books wqb
    LEFT JOIN wrong_questions wq ON wqb.id = wq.book_id
        WHERE wqb.user_id = ?
     GROUP BY wqb.id
     ORDER BY wqb.is_default DESC, wqb.created_at DESC`,
      [userId]
    )
    return rows
  }

  async updateBook(bookId: number, userId: number, patch: Partial<WrongQuestionBook>) {
    const keys = Object.keys(patch).filter(k => !['id', 'user_id', 'created_at', 'updated_at'].includes(k))
    if (!keys.length) return
    const fields = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => (patch as any)[k])
    await this.db.query(`UPDATE wrong_question_books SET ${fields}, updated_at = NOW() WHERE id = ? AND user_id = ?`, [
      ...values,
      bookId,
      userId,
    ])
  }

  async deleteBookCascade(bookId: number, userId: number) {
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT is_default FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      )
      if (!rows.length) throw new Error('错题本不存在')
      if (rows[0].is_default) throw new Error('默认错题本不能删除')

      await conn.query(
        `DELETE FROM wrong_question_practice_records
          WHERE wrong_question_id IN (SELECT id FROM wrong_questions WHERE book_id = ?)`,
        [bookId]
      )
      await conn.query('DELETE FROM wrong_questions WHERE book_id = ?', [bookId])
      await conn.query('DELETE FROM wrong_question_book_shares WHERE book_id = ?', [bookId])
      await conn.query('DELETE FROM wrong_question_books WHERE id = ? AND user_id = ?', [bookId, userId])

      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // questions
  async findExistingWrongQuestion(bookId: number, questionId: number): Promise<{ id: number } | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT id FROM wrong_questions WHERE book_id = ? AND question_id = ?',
      [bookId, questionId]
    )
    return rows[0] ? { id: Number(rows[0].id) } : null
  }

  async upsertWrongQuestion(data: Omit<WrongQuestion, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const exist = await this.findExistingWrongQuestion(data.book_id, data.question_id)
    if (exist) {
      await this.db.query(
        `UPDATE wrong_questions SET
           wrong_count = wrong_count + ?,
           last_wrong_time = ?,
           exam_result_id = COALESCE(?, exam_result_id),
           mastery_level = ?,
           tags = COALESCE(?, tags),
           notes = COALESCE(?, notes),
           updated_at = NOW()
         WHERE id = ?`,
        [
          data.wrong_count,
          data.last_wrong_time,
          data.exam_result_id ?? null,
          data.mastery_level,
          data.tags ?? null,
          data.notes ?? null,
          exist.id,
        ]
      )
      return exist.id
    }
    const [ret] = await this.db.query<ResultSetHeader>(
      `INSERT INTO wrong_questions
        (book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.book_id,
        data.question_id,
        data.exam_result_id ?? null,
        data.wrong_count,
        data.last_wrong_time,
        data.mastery_level,
        data.tags || '',
        data.notes || '',
      ]
    )
    return ret.insertId
  }

  async ensureBookOwnership(bookId: number, userId: number): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT 1 FROM wrong_question_books WHERE id = ? AND user_id = ?',
      [bookId, userId]
    )
    return !!rows.length
  }

  async listWrongQuestions(
    bookId: number,
    opts: { page: number; limit: number; mastery_level?: string; tags?: string; search?: string }
  ) {
    if (opts.limit > 100) opts.limit = 100
    const offset = (opts.page - 1) * opts.limit
    let where = 'WHERE wq.book_id = ?'
    const params: any[] = [bookId]

    if (opts.mastery_level) {
      where += ' AND wq.mastery_level = ?'
      params.push(opts.mastery_level)
    }
    if (opts.tags) {
      where += ' AND wq.tags LIKE ?'
      params.push(`%${opts.tags}%`)
    }
    if (opts.search) {
      where += ' AND (q.content LIKE ? OR q.title LIKE ?)'
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }

    const [cnt] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
         FROM wrong_questions wq
         JOIN questions q ON wq.question_id = q.id
        ${where}`,
      params
    )

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT wq.*, q.content, q.title, q.type, q.difficulty,
              COUNT(pr.id) AS practice_count,
              COUNT(CASE WHEN pr.is_correct=1 THEN 1 END) AS correct_count
         FROM wrong_questions wq
         JOIN questions q ON wq.question_id = q.id
    LEFT JOIN wrong_question_practice_records pr ON wq.id = pr.wrong_question_id
        ${where}
     GROUP BY wq.id
     ORDER BY wq.last_wrong_time DESC
        LIMIT ? OFFSET ?`,
      [...params, opts.limit, offset]
    )

    return { rows, total: Number(cnt[0]?.total || 0) }
  }

  async updateWrongQuestion(questionId: number, patch: Partial<WrongQuestion>) {
    const keys = Object.keys(patch).filter(k => !['id', 'created_at', 'updated_at', 'book_id'].includes(k))
    if (!keys.length) return
    const fields = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => (patch as any)[k])
    await this.db.query(`UPDATE wrong_questions SET ${fields}, updated_at = NOW() WHERE id = ?`, [
      ...values,
      questionId,
    ])
  }

  async removeWrongQuestionCascade(questionId: number) {
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('DELETE FROM wrong_question_practice_records WHERE wrong_question_id = ?', [questionId])
      await conn.query('DELETE FROM wrong_questions WHERE id = ?', [questionId])
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  async addPracticeRecord(r: Omit<PracticeRecord, 'id' | 'created_at'>): Promise<number> {
    const [ret] = await this.db.query<ResultSetHeader>(
      `INSERT INTO wrong_question_practice_records (user_id, wrong_question_id, is_correct, time_spent, practice_time)
       VALUES (?, ?, ?, ?, ?)`,
      [r.user_id, r.wrong_question_id, r.is_correct ? 1 : 0, r.time_spent, r.practice_time]
    )
    return ret.insertId
  }

  async recentCorrectFlags(wrongQuestionId: number, n = 5) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT is_correct
         FROM wrong_question_practice_records
        WHERE wrong_question_id = ?
     ORDER BY practice_time DESC
        LIMIT ?`,
      [wrongQuestionId, n]
    )
    return rows.map(r => Number(r.is_correct) === 1)
  }

  async setMasteryLevel(wrongQuestionId: number, level: MasteryLevel) {
    await this.db.query('UPDATE wrong_questions SET mastery_level = ?, updated_at = NOW() WHERE id = ?', [
      level,
      wrongQuestionId,
    ])
  }

  async makeShare(
    bookId: number,
    sharedBy: number,
    opts: { shared_to?: number; is_public: boolean; expires_at?: string }
  ): Promise<string> {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase()
    await this.db.query<ResultSetHeader>(
      `INSERT INTO wrong_question_book_shares (book_id, shared_by, shared_to, share_code, is_public, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bookId, sharedBy, opts.shared_to ?? null, code, opts.is_public ? 1 : 0, opts.expires_at ?? null]
    )
    return code
  }

  async getShare(code: string, userId: number) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT wqbs.*, wqb.name, wqb.description, u.username AS shared_by_name
         FROM wrong_question_book_shares wqbs
         JOIN wrong_question_books wqb ON wqbs.book_id = wqb.id
         JOIN users u ON wqbs.shared_by = u.id
        WHERE wqbs.share_code = ?
          AND (wqbs.expires_at IS NULL OR wqbs.expires_at > NOW())
          AND (wqbs.is_public = 1 OR wqbs.shared_to = ? OR wqbs.shared_by = ?)`,
      [code, userId, userId]
    )
    if (!rows.length) return null
    await this.db.query('UPDATE wrong_question_book_shares SET access_count = access_count + 1 WHERE id = ?', [
      rows[0].id,
    ])
    return rows[0]
  }

  async collectFromExamResult(examResultId: number) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT DISTINCT
          era.question_id,
          q.title, q.content, q.type, q.difficulty,
          e.title AS exam_title,
          s.name  AS subject
         FROM exam_result_answers era
         JOIN questions q ON era.question_id = q.id
         JOIN exam_results er ON era.exam_result_id = er.id
         JOIN exams e ON er.exam_id = e.id
    LEFT JOIN subjects s ON q.subject_id = s.id
        WHERE era.exam_result_id = ?
          AND era.is_correct = 0`,
      [examResultId]
    )
    return rows
  }

  async statistics(userId: number) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
         COUNT(DISTINCT wqb.id) AS book_count,
         COUNT(DISTINCT wq.id) AS total_wrong_questions,
         COUNT(CASE WHEN wq.mastery_level='mastered' THEN 1 END) AS mastered_count,
         COUNT(CASE WHEN wq.mastery_level='partially_mastered' THEN 1 END) AS partially_mastered_count,
         COUNT(CASE WHEN wq.mastery_level='not_mastered' THEN 1 END) AS not_mastered_count,
         COUNT(DISTINCT pr.id) AS total_practice_count,
         COUNT(CASE WHEN pr.is_correct=1 THEN 1 END) AS correct_practice_count
        FROM wrong_question_books wqb
   LEFT JOIN wrong_questions wq ON wqb.id = wq.book_id
   LEFT JOIN wrong_question_practice_records pr ON wq.id = pr.wrong_question_id
       WHERE wqb.user_id = ?`,
      [userId]
    )
    return rows[0]
  }
}
