import { pool } from '@config/database.js'
import { LoggerService as Logger } from '@infrastructure/logging/logger.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

// ---- 日志：安全薄封装，规避签名不一致导致的 TS 报错 ----
const safeLogSystem = (level: 'info' | 'warn' | 'error', message: string, meta?: any) => {
  try {
    const fn =
      (Logger as any).logSystemLog ?? (Logger as any).logSystem ?? (Logger as any).system ?? (Logger as any).default
    if (typeof fn === 'function') {
      // 兼容对象入参或多参写法
      return fn.length >= 2 ? fn(level, message, meta) : fn({ level, message, meta })
    }
    // 降级到控制台
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](message, meta || '')
  } catch {
    // 静默
  }
}
const safeLogUserAction = (...args: any[]) => {
  try {
    const fn = (Logger as any).logUserAction ?? (Logger as any).userAction ?? (Logger as any).default
    if (typeof fn === 'function') return fn(...args)
  } catch {
    // 忽略
  }
}

export interface IWrongQuestionBook {
  id?: number
  user_id: number
  name: string
  description?: string
  is_default: boolean
  is_public: boolean
  created_at?: string
  updated_at?: string
}

export interface IWrongQuestion {
  id?: number
  book_id: number
  question_id: number
  exam_result_id?: number
  wrong_count: number
  last_wrong_time: string
  mastery_level: 'not_mastered' | 'partially_mastered' | 'mastered'
  tags?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface IPracticeRecord {
  id?: number
  user_id: number
  wrong_question_id: number
  is_correct: boolean
  time_spent: number
  practice_time: string
  created_at?: string
}

export interface IWrongQuestionBookShare {
  id?: number
  book_id: number
  shared_by: number
  shared_to?: number
  share_code: string
  is_public: boolean
  access_count: number
  expires_at?: string
  created_at?: string
}

export class WrongQuestionService {
  // —— 错题本 —— //
  static async createBook(bookData: Omit<IWrongQuestionBook, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const { user_id, name, description, is_default, is_public } = bookData

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_question_books (user_id, name, description, is_default, is_public)
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, name, description || '', is_default, is_public]
      )

      safeLogUserAction(user_id, 'create_wrong_question_book', 'wrong_question_books', result.insertId, { name })
      return result.insertId
    } catch (error: any) {
      safeLogSystem('error', 'Failed to create wrong question book', {
        error: error.message,
        user_id: bookData.user_id,
      })
      throw error
    }
  }

  static async getUserBooks(userId: number): Promise<any[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT wqb.*,
                COUNT(wq.id)                                          AS question_count,
                COUNT(CASE WHEN wq.mastery_level='mastered' THEN 1 END) AS mastered_count
         FROM wrong_question_books wqb
         LEFT JOIN wrong_questions wq ON wqb.id = wq.book_id
         WHERE wqb.user_id = ?
         GROUP BY wqb.id
         ORDER BY wqb.is_default DESC, wqb.created_at DESC`,
        [userId]
      )

      return rows
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get user wrong question books', { error: error.message, user_id: userId })
      throw error
    }
  }

  static async updateBook(bookId: number, userId: number, updates: Partial<IWrongQuestionBook>): Promise<void> {
    try {
      const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id') as Array<keyof IWrongQuestionBook>
      if (keys.length === 0) return

      const fields = keys.map(k => `${k} = ?`).join(', ')
      const values = keys.map(k => updates[k] as any)

      await pool.execute(
        `UPDATE wrong_question_books
            SET ${fields}, updated_at = NOW()
          WHERE id = ? AND user_id = ?`,
        [...values, bookId, userId]
      )

      safeLogUserAction(userId, 'update_wrong_question_book', 'wrong_question_books', bookId, updates)
    } catch (error: any) {
      safeLogSystem('error', 'Failed to update wrong question book', {
        error: error.message,
        book_id: bookId,
        user_id: userId,
      })
      throw error
    }
  }

  static async deleteBook(bookId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 校验存在 & 默认本
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT is_default FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      )
      if (rows.length === 0) throw new Error('错题本不存在')
      if ((rows[0] as any).is_default) throw new Error('默认错题本不能删除')

      // 级联删除
      await connection.execute(
        `DELETE FROM wrong_question_practice_records
          WHERE wrong_question_id IN (SELECT id FROM wrong_questions WHERE book_id = ?)`,
        [bookId]
      )
      await connection.execute('DELETE FROM wrong_questions WHERE book_id = ?', [bookId])
      await connection.execute('DELETE FROM wrong_question_book_shares WHERE book_id = ?', [bookId])
      await connection.execute('DELETE FROM wrong_question_books WHERE id = ? AND user_id = ?', [bookId, userId])

      await connection.commit()
      safeLogUserAction(userId, 'delete_wrong_question_book', 'wrong_question_books', bookId)
    } catch (error: any) {
      await connection.rollback()
      safeLogSystem('error', 'Failed to delete wrong question book', {
        error: error.message,
        book_id: bookId,
        user_id: userId,
      })
      throw error
    } finally {
      connection.release()
    }
  }

  // —— 错题 —— //
  static async addWrongQuestion(
    questionData: Omit<IWrongQuestion, 'id' | 'created_at' | 'updated_at'>
  ): Promise<number> {
    try {
      const { book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags, notes } =
        questionData

      // 已存在则累加
      const [exist] = await pool.execute<RowDataPacket[]>(
        'SELECT id, wrong_count FROM wrong_questions WHERE book_id = ? AND question_id = ?',
        [book_id, question_id]
      )
      if (exist.length > 0) {
        const existingId = (exist[0] as any).id as number
        await pool.execute(
          `UPDATE wrong_questions SET
             wrong_count = wrong_count + ?,
             last_wrong_time = ?,
             exam_result_id = COALESCE(?, exam_result_id),
             mastery_level = ?,
             tags   = COALESCE(?, tags),
             notes  = COALESCE(?, notes),
             updated_at = NOW()
           WHERE id = ?`,
          [wrong_count, last_wrong_time, exam_result_id ?? null, mastery_level, tags ?? null, notes ?? null, existingId]
        )
        return existingId
      }

      const [insert] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_questions
           (book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          book_id,
          question_id,
          exam_result_id ?? null,
          wrong_count,
          last_wrong_time,
          mastery_level,
          tags || '',
          notes || '',
        ]
      )
      return insert.insertId
    } catch (error: any) {
      safeLogSystem('error', 'Failed to add wrong question', {
        error: error.message,
        question_id: questionData.question_id,
      })
      throw error
    }
  }

  static async getWrongQuestions(
    bookId: number,
    userId: number,
    options: { page?: number; limit?: number; mastery_level?: string; tags?: string; search?: string } = {}
  ): Promise<{ questions: any[]; total: number }> {
    try {
      const page = Math.max(1, options.page ?? 1)
      const limit = Math.min(100, options.limit ?? 20)
      const offset = (page - 1) * limit

      // 权限
      const [bookRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      )
      if (bookRows.length === 0) throw new Error('无权访问此错题本')

      let where = 'WHERE wq.book_id = ?'
      const params: any[] = [bookId]

      if (options.mastery_level) {
        where += ' AND wq.mastery_level = ?'
        params.push(options.mastery_level)
      }
      if (options.tags) {
        where += ' AND wq.tags LIKE ?'
        params.push(`%${options.tags}%`)
      }
      if (options.search) {
        where += ' AND (q.content LIKE ? OR q.title LIKE ?)'
        params.push(`%${options.search}%`, `%${options.search}%`)
      }

      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
           FROM wrong_questions wq
           JOIN questions q ON wq.question_id = q.id
         ${where}`,
        params
      )

      const [dataRows] = await pool.execute<RowDataPacket[]>(
        `SELECT wq.*, q.content, q.title, q.type, q.difficulty,
                COUNT(pr.id)                                       AS practice_count,
                COUNT(CASE WHEN pr.is_correct=1 THEN 1 END)        AS correct_count
           FROM wrong_questions wq
           JOIN questions q ON wq.question_id = q.id
      LEFT JOIN wrong_question_practice_records pr ON wq.id = pr.wrong_question_id
         ${where}
       GROUP BY wq.id
       ORDER BY wq.last_wrong_time DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )

      return { questions: dataRows, total: Number((countRows[0] as any).total) || 0 }
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get wrong questions', {
        error: error.message,
        book_id: bookId,
        user_id: userId,
      })
      throw error
    }
  }

  static async updateWrongQuestion(
    questionId: number,
    userId: number,
    updates: Partial<IWrongQuestion>
  ): Promise<void> {
    try {
      // 权限
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT wq.id
           FROM wrong_questions wq
           JOIN wrong_question_books wqb ON wq.book_id = wqb.id
          WHERE wq.id = ? AND wqb.user_id = ?`,
        [questionId, userId]
      )
      if (rows.length === 0) throw new Error('无权修改此错题')

      const keys = Object.keys(updates).filter(k => k !== 'id') as Array<keyof IWrongQuestion>
      if (keys.length === 0) return

      const fields = keys.map(k => `${k} = ?`).join(', ')
      const values = keys.map(k => updates[k] as any)

      await pool.execute(
        `UPDATE wrong_questions
            SET ${fields}, updated_at = NOW()
          WHERE id = ?`,
        [...values, questionId]
      )

      safeLogUserAction(userId, 'update_wrong_question', 'wrong_questions', questionId, updates)
    } catch (error: any) {
      safeLogSystem('error', 'Failed to update wrong question', {
        error: error.message,
        question_id: questionId,
        user_id: userId,
      })
      throw error
    }
  }

  static async removeWrongQuestion(questionId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 权限
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT wq.id
           FROM wrong_questions wq
           JOIN wrong_question_books wqb ON wq.book_id = wqb.id
          WHERE wq.id = ? AND wqb.user_id = ?`,
        [questionId, userId]
      )
      if (rows.length === 0) throw new Error('无权删除此错题')

      await connection.execute('DELETE FROM wrong_question_practice_records WHERE wrong_question_id = ?', [questionId])
      await connection.execute('DELETE FROM wrong_questions WHERE id = ?', [questionId])

      await connection.commit()
      safeLogUserAction(userId, 'remove_wrong_question', 'wrong_questions', questionId)
    } catch (error: any) {
      await connection.rollback()
      safeLogSystem('error', 'Failed to remove wrong question', {
        error: error.message,
        question_id: questionId,
        user_id: userId,
      })
      throw error
    } finally {
      connection.release()
    }
  }

  // —— 练习记录 —— //
  static async addPracticeRecord(recordData: Omit<IPracticeRecord, 'id' | 'created_at'>): Promise<number> {
    try {
      const { user_id, wrong_question_id, is_correct, time_spent, practice_time } = recordData

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_question_practice_records
           (user_id, wrong_question_id, is_correct, time_spent, practice_time)
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, wrong_question_id, is_correct ? 1 : 0, time_spent, practice_time]
      )

      await WrongQuestionService.updateMasteryLevel(wrong_question_id, !!is_correct)
      safeLogUserAction(user_id, 'practice_wrong_question', 'wrong_question_practice_records', result.insertId, {
        is_correct,
        time_spent,
      })

      return result.insertId
    } catch (error: any) {
      safeLogSystem('error', 'Failed to add practice record', {
        error: error.message,
        user_id: recordData.user_id,
        wrong_question_id: recordData.wrong_question_id,
      })
      throw error
    }
  }

  static async updateMasteryLevel(wrongQuestionId: number, _isCorrect: boolean): Promise<void> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT is_correct
           FROM wrong_question_practice_records
          WHERE wrong_question_id = ?
       ORDER BY practice_time DESC
          LIMIT 5`,
        [wrongQuestionId]
      )

      let masteryLevel: IWrongQuestion['mastery_level'] = 'not_mastered'
      if (rows.length >= 3) {
        const recent3AllCorrect = rows.slice(0, 3).every(r => (r as any).is_correct === 1)
        const recent5AllCorrect = rows.length >= 5 && rows.every(r => (r as any).is_correct === 1)
        if (recent5AllCorrect) masteryLevel = 'mastered'
        else if (recent3AllCorrect) masteryLevel = 'partially_mastered'
      }

      await pool.execute('UPDATE wrong_questions SET mastery_level = ?, updated_at = NOW() WHERE id = ?', [
        masteryLevel,
        wrongQuestionId,
      ])
    } catch (error: any) {
      safeLogSystem('error', 'Failed to update mastery level', {
        error: error.message,
        wrong_question_id: wrongQuestionId,
      })
      throw error
    }
  }

  // —— 分享 —— //
  static async shareBook(
    bookId: number,
    userId: number,
    shareData: { shared_to?: number; is_public: boolean; expires_at?: string }
  ): Promise<string> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      )
      if (rows.length === 0) throw new Error('无权分享此错题本')

      const shareCode = Math.random().toString(36).slice(2, 10).toUpperCase()
      const { shared_to, is_public, expires_at } = shareData

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_question_book_shares
           (book_id, shared_by, shared_to, share_code, is_public, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookId, userId, shared_to ?? null, shareCode, is_public ? 1 : 0, expires_at ?? null]
      )

      safeLogUserAction(userId, 'share_wrong_question_book', 'wrong_question_book_shares', result.insertId, {
        share_code: shareCode,
        is_public,
      })
      return shareCode
    } catch (error: any) {
      safeLogSystem('error', 'Failed to share wrong question book', {
        error: error.message,
        book_id: bookId,
        user_id: userId,
      })
      throw error
    }
  }

  static async getSharedBook(shareCode: string, userId: number): Promise<any> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT wqbs.*, wqb.name, wqb.description, u.username AS shared_by_name
           FROM wrong_question_book_shares wqbs
           JOIN wrong_question_books wqb ON wqbs.book_id = wqb.id
           JOIN users u ON wqbs.shared_by = u.id
          WHERE wqbs.share_code = ?
            AND (wqbs.expires_at IS NULL OR wqbs.expires_at > NOW())
            AND (wqbs.is_public = 1 OR wqbs.shared_to = ? OR wqbs.shared_by = ?)`,
        [shareCode, userId, userId]
      )
      if (rows.length === 0) throw new Error('分享链接无效或已过期')

      await pool.execute('UPDATE wrong_question_book_shares SET access_count = access_count + 1 WHERE id = ?', [
        (rows[0] as any).id,
      ])

      return rows[0]
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get shared wrong question book', {
        error: error.message,
        share_code: shareCode,
        user_id: userId,
      })
      throw error
    }
  }

  // —— 统计 —— //
  static async getStatistics(userId: number): Promise<any> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           COUNT(DISTINCT wqb.id)                                   AS book_count,
           COUNT(DISTINCT wq.id)                                    AS total_wrong_questions,
           COUNT(CASE WHEN wq.mastery_level='mastered' THEN 1 END)  AS mastered_count,
           COUNT(CASE WHEN wq.mastery_level='partially_mastered' THEN 1 END) AS partially_mastered_count,
           COUNT(CASE WHEN wq.mastery_level='not_mastered' THEN 1 END) AS not_mastered_count,
           COUNT(DISTINCT pr.id)                                    AS total_practice_count,
           COUNT(CASE WHEN pr.is_correct=1 THEN 1 END)              AS correct_practice_count
          FROM wrong_question_books wqb
     LEFT JOIN wrong_questions wq ON wqb.id = wq.book_id
     LEFT JOIN wrong_question_practice_records pr ON wq.id = pr.wrong_question_id
         WHERE wqb.user_id = ?`,
        [userId]
      )
      return rows[0]
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get wrong question statistics', { error: error.message, user_id: userId })
      throw error
    }
  }

  // —— 从考试结果收集错题 —— //
  static async getWrongQuestionsFromExamResult(examResultId: number): Promise<
    Array<{
      question_id: number
      title?: string
      content?: string
      type?: string
      difficulty?: number
      exam_title?: string
      subject?: string
    }>
  > {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
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
      return rows as any
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get wrong questions from exam result', {
        error: error.message,
        exam_result_id: examResultId,
      })
      throw error
    }
  }

  // —— 批量 —— //
  static async batchAddWrongQuestions(
    bookId: number,
    questionIds: number[],
    examResultId?: number
  ): Promise<{ success: number[]; failed: { questionId: number; error: string }[] }> {
    const success: number[] = []
    const failed: { questionId: number; error: string }[] = []

    for (const questionId of questionIds) {
      try {
        await WrongQuestionService.addWrongQuestion({
          book_id: bookId,
          question_id: questionId,
          exam_result_id: examResultId,
          wrong_count: 1,
          last_wrong_time: new Date().toISOString(),
          mastery_level: 'not_mastered',
          tags: '',
          notes: '',
        })
        success.push(questionId)
      } catch (error: any) {
        failed.push({ questionId, error: error?.message || '未知错误' })
      }
    }
    return { success, failed }
  }
}

export default WrongQuestionService
