/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/backend/src/modules/wrong-questions/repositories/wq.repository.ts

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool as basePool } from '@/config/database'
import type { MasteryLevel, PracticeRecord, WrongQuestion, WrongQuestionBook } from '../domain/wq.model'

/**
 * 关键：声明我们“实际用到”的最小接口，屏蔽 mysql2 在不同环境/版本上的类型差异，
 * 避免 “Pool 上不存在 query/execute/getConnection” 以及 “类型未知” 报错。
 */
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

// 将各种时间输入转成 MySQL 可接受的 Date（非法则返回 null）
function toMySQLDate(v?: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const d = new Date(v as any)
  return isNaN(d.getTime()) ? null : d
}

export class WrongQuestionRepository {
  constructor(private readonly db: DBPool = pool) {}

  // ---------------------------- books ----------------------------
  async createBook(b: Omit<WrongQuestionBook, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const [ret] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO wrong_question_books (user_id, name, description, is_default, is_public)
       VALUES (?, ?, ?, ?, ?)`,
      [b.user_id, b.name, b.description || '', b.is_default, b.is_public]
    )
    return ret.insertId
  }

  async getBooksWithStats(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
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
    await this.db.execute(
      `UPDATE wrong_question_books SET ${fields}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [...values, bookId, userId]
    )
  }

  async deleteBookCascade(bookId: number, userId: number) {
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT is_default FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      )
      if (!rows.length) throw new Error('错题本不存在')
      if ((rows[0] as any).is_default) throw new Error('默认错题本不能删除')

      await conn.execute(
        `DELETE FROM wrong_question_practice_records
          WHERE wrong_question_id IN (SELECT id FROM wrong_questions WHERE book_id = ?)`,
        [bookId]
      )
      await conn.execute('DELETE FROM wrong_questions WHERE book_id = ?', [bookId])
      await conn.execute('DELETE FROM wrong_question_book_shares WHERE book_id = ?', [bookId])
      await conn.execute('DELETE FROM wrong_question_books WHERE id = ? AND user_id = ?', [bookId, userId])

      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // ------------------------- questions --------------------------
  /** 去重时带上 user_id，避免跨用户冲突 */
  async findExistingWrongQuestion(userId: number, bookId: number, questionId: number): Promise<{ id: number } | null> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      'SELECT id FROM wrong_questions WHERE user_id = ? AND book_id = ? AND question_id = ?',
      [userId, bookId, questionId]
    )
    return rows[0] ? { id: Number((rows[0] as any).id) } : null
  }

  async upsertWrongQuestion(data: Omit<WrongQuestion, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const exist = await this.findExistingWrongQuestion(data.user_id, data.book_id, data.question_id)
    const lastWrongTime = toMySQLDate(data.last_wrong_time) ?? new Date()

    if (exist) {
      await this.db.execute(
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
          lastWrongTime,
          data.exam_result_id ?? null,
          data.mastery_level,
          data.tags ?? '',
          data.notes ?? '',
          exist.id,
        ]
      )
      return exist.id
    }

    const [ret] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO wrong_questions
         (user_id, book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.book_id,
        data.question_id,
        data.exam_result_id ?? null,
        data.wrong_count,
        lastWrongTime,
        data.mastery_level,
        data.tags || '',
        data.notes || '',
      ]
    )
    return ret.insertId
  }

  async ensureBookOwnership(bookId: number, userId: number): Promise<boolean> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
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

    const [cntRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
         FROM wrong_questions wq
         JOIN questions q ON wq.question_id = q.id
        ${where}`,
      params
    )
    const total = Number((cntRows[0] as any)?.total ?? 0)

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
         wq.*,
         q.content, q.title, q.question_type, q.difficulty,
         COALESCE(pr.practice_count, 0) AS practice_count,
         COALESCE(pr.correct_count, 0)  AS correct_count
        FROM wrong_questions wq
        JOIN questions q ON wq.question_id = q.id
        LEFT JOIN (
          SELECT wrong_question_id,
                 COUNT(*) AS practice_count,
                 SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct_count
          FROM wrong_question_practice_records
          GROUP BY wrong_question_id
        ) pr ON pr.wrong_question_id = wq.id
       ${where}
       ORDER BY wq.last_wrong_time DESC
       LIMIT ? OFFSET ?`,
      [...params, opts.limit, offset]
    )

    return { rows, total }
  }

  async updateWrongQuestion(questionId: number, patch: Partial<WrongQuestion>) {
    const keys = Object.keys(patch).filter(k => !['id', 'created_at', 'updated_at', 'book_id', 'user_id'].includes(k))
    if (!keys.length) return

    const fields: string[] = []
    const values: any[] = []

    for (const k of keys) {
      if (k === 'last_wrong_time') {
        fields.push('last_wrong_time = ?')
        values.push(toMySQLDate((patch as any)[k]) ?? new Date())
      } else {
        fields.push(`${k} = ?`)
        values.push((patch as any)[k])
      }
    }

    await this.db.execute(`UPDATE wrong_questions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, [
      ...values,
      questionId,
    ])
  }

  async removeWrongQuestionCascade(questionId: number) {
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute('DELETE FROM wrong_question_practice_records WHERE wrong_question_id = ?', [questionId])
      await conn.execute('DELETE FROM wrong_questions WHERE id = ?', [questionId])
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // --------------------------- practice --------------------------
  async addPracticeRecord(r: Omit<PracticeRecord, 'id' | 'created_at'>): Promise<number> {
    const practiceTime = toMySQLDate((r as any).practice_time) ?? new Date()
    const [ret] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO wrong_question_practice_records (user_id, wrong_question_id, is_correct, time_spent, practice_time)
       VALUES (?, ?, ?, ?, ?)`,
      [r.user_id, r.wrong_question_id, r.is_correct ? 1 : 0, r.time_spent, practiceTime]
    )
    return ret.insertId
  }

  async recentCorrectFlags(wrongQuestionId: number, n = 5) {
    const limit = Number.isFinite(Number(n)) ? Math.max(1, Math.floor(Number(n))) : 5
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT is_correct
         FROM wrong_question_practice_records
        WHERE wrong_question_id = ?
        ORDER BY practice_time DESC
        LIMIT ${limit}`,
      [wrongQuestionId]
    )
    return rows.map((r: RowDataPacket) => Number((r as any).is_correct) === 1)
  }

  async setMasteryLevel(wrongQuestionId: number, level: MasteryLevel) {
    await this.db.execute('UPDATE wrong_questions SET mastery_level = ?, updated_at = NOW() WHERE id = ?', [
      level,
      wrongQuestionId,
    ])
  }

  // ---------------- sharing / collect / statistics ---------------
  async makeShare(
    bookId: number,
    sharedBy: number,
    opts: { shared_to?: number; is_public: boolean; expires_at?: string }
  ): Promise<string> {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase()
    await this.db.execute<ResultSetHeader>(
      `INSERT INTO wrong_question_book_shares (book_id, shared_by, shared_to, share_code, is_public, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bookId, sharedBy, opts.shared_to ?? null, code, opts.is_public ? 1 : 0, opts.expires_at ?? null]
    )
    return code
  }

  async getShare(code: string, userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
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
    await this.db.execute('UPDATE wrong_question_book_shares SET access_count = access_count + 1 WHERE id = ?', [
      (rows[0] as any).id,
    ])
    return rows[0]
  }

  // 从考试结果收集错题（仅错误/未判定）
  async collectFromExamResult(
    examResultId: number
  ): Promise<Array<{ question_id: number; exam_title?: string; subject?: string }>> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT
          ar.question_id AS question_id,
          e.title        AS exam_title,
          ''             AS subject
         FROM answer_records ar
         JOIN exam_results er ON er.id = ar.exam_result_id
         LEFT JOIN exams e    ON e.id = er.exam_id
        WHERE ar.exam_result_id = ?
          AND (ar.is_correct = 0 OR ar.is_correct IS NULL)
        ORDER BY ar.question_id ASC`,
      [examResultId]
    )

    return rows.map((r: RowDataPacket) => ({
      question_id: Number((r as any).question_id),
      exam_title: (r as any).exam_title ?? '',
      subject: '',
    }))
  }

  async statistics(userId: number) {
    const [rows] = await this.db.execute<RowDataPacket[]>(
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
