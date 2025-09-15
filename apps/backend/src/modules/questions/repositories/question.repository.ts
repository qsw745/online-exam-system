// apps/backend/src/modules/questions/repositories/question.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IQuestion } from '../domain/question.model.js'

export const QuestionRepository = {
    async findByIds(ids: number[]): Promise<IQuestion[]> {
        if (!ids.length) return []
        // 使用占位符防注入；顺序在 service 做二次排序
        const placeholders = ids.map(() => '?').join(',')
        const [rows] = await pool.query<IQuestion[]>(
            `SELECT * FROM questions WHERE id IN (${placeholders})`,
            ids
        )
        return rows
    },
  async list(whereSql: string, vals: any[], limit: number, offset: number): Promise<IQuestion[]> {
    const [rows] = await pool.query<IQuestion[]>(
      `SELECT * FROM questions ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    )
    return rows
  },

  async count(whereSql: string, vals: any[]): Promise<number> {
    const [[row]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM questions ${whereSql}`, vals)
    return Number((row as any)?.total) || 0
  },

  async findById(id: number): Promise<IQuestion | null> {
    const [rows] = await pool.query<IQuestion[]>('SELECT * FROM questions WHERE id = ?', [id])
    return rows[0] ?? null
  },

  async insert(data: {
    title: string
    content: string
    question_type: string
    options: string | null
    correct_answer: string
    knowledge_points: string
    tags: string
    explanation: string
    difficulty: 'easy' | 'medium' | 'hard'
    exam_id: number | null
    score: number
  }): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO questions
       (title, content, question_type, options, correct_answer, knowledge_points, tags, explanation, difficulty, exam_id, score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.content,
        data.question_type,
        data.options,
        data.correct_answer,
        data.knowledge_points,
        data.tags,
        data.explanation,
        data.difficulty,
        data.exam_id,
        data.score,
      ]
    )
    return ret.insertId
  },

  async update(id: number, sets: string[], vals: any[]): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>(
      `UPDATE questions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async delete(id: number): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>('DELETE FROM questions WHERE id = ?', [id])
    return ret.affectedRows
  },

  async findDup(content: string, type: string): Promise<number | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM questions WHERE content = ? AND question_type = ?',
      [content, type]
    )
    return (rows as any[])[0]?.id ?? null
  },

  // practice & wrong-questions
  async insertPractice(userId: number, questionId: number, isCorrect: boolean, answer: any) {
    await pool.query(
      'INSERT INTO practice_records (user_id, question_id, is_correct, user_answer) VALUES (?, ?, ?, ?)',
      [userId, questionId, isCorrect, JSON.stringify(answer)]
    )
  },

  async selectWrong(userId: number, questionId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM wrong_questions WHERE user_id = ? AND question_id = ?',
      [userId, questionId]
    )
    return rows as any[]
  },

  async incWrong(userId: number, questionId: number) {
    await pool.query(
      'UPDATE wrong_questions SET wrong_count = wrong_count + 1, last_practice_time = NOW(), is_mastered = FALSE WHERE user_id = ? AND question_id = ?',
      [userId, questionId]
    )
  },

  async insertWrong(userId: number, questionId: number) {
    await pool.query(
      'INSERT INTO wrong_questions (user_id, question_id, wrong_count, correct_count) VALUES (?, ?, 1, 0)',
      [userId, questionId]
    )
  },

  async incCorrect(userId: number, questionId: number) {
    await pool.query(
      'UPDATE wrong_questions SET correct_count = correct_count + 1, last_practice_time = NOW() WHERE user_id = ? AND question_id = ?',
      [userId, questionId]
    )
  },

  async selectCorrectCount(userId: number, questionId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT correct_count FROM wrong_questions WHERE user_id = ? AND question_id = ?',
      [userId, questionId]
    )
    return Number((rows as any[])[0]?.correct_count ?? 0)
  },

  async setMastered(userId: number, questionId: number) {
    await pool.query('UPDATE wrong_questions SET is_mastered = TRUE WHERE user_id = ? AND question_id = ?', [
      userId,
      questionId,
    ])
  },

  async listWrong(whereSql: string, vals: any[], limit: number, offset: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        wq.*, q.content, q.question_type, q.options, q.correct_answer, q.explanation, q.knowledge_points, q.tags
       FROM wrong_questions wq
       JOIN questions q ON wq.question_id = q.id
       ${whereSql}
       ORDER BY wq.last_practice_time DESC
       LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    )
    return rows as any[]
  },

  async countWrong(whereSql: string, vals: any[]): Promise<number> {
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM wrong_questions wq ${whereSql}`,
      vals
    )
    return Number((row as any)?.total) || 0
  },

  async removeWrong(userId: number, questionId: number) {
    await pool.query('DELETE FROM wrong_questions WHERE user_id = ? AND question_id = ?', [userId, questionId])
  },

  async practicedIds(userId: number): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT question_id FROM practice_records WHERE user_id = ? ORDER BY question_id',
      [userId]
    )
    return (rows as any[]).map(r => Number(r.question_id))
  },

  async stats(userId: number) {
    const [[totalPractice]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM practice_records WHERE user_id = ?',
      [userId]
    )
    const [[correct]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as correct FROM practice_records WHERE user_id = ? AND is_correct = TRUE',
      [userId]
    )
    const [[wrong]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND is_mastered = FALSE',
      [userId]
    )
    const [[mastered]] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND is_mastered = TRUE',
      [userId]
    )
    return {
      totalPractice: Number((totalPractice as any)?.total || 0),
      correct: Number((correct as any)?.correct || 0),
      wrong: Number((wrong as any)?.total || 0),
      mastered: Number((mastered as any)?.total || 0),
    }
  },

  async tagsAgg() {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', numbers.n, ']'))) as tag
         FROM questions
         CROSS JOIN (
           SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
           UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
           UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
           UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
         ) numbers
        WHERE JSON_LENGTH(tags) > numbers.n
          AND JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', numbers.n, ']'))) IS NOT NULL
        ORDER BY tag`
    )
    return (rows as any[]).map(r => r.tag).filter((t: string | null) => !!t && t !== 'null')
  },

  async knowledgeAgg() {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(knowledge_points, CONCAT('$[', numbers.n, ']'))) as knowledge_point
         FROM questions
         CROSS JOIN (
           SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
           UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
         ) numbers
        WHERE JSON_LENGTH(knowledge_points) > numbers.n
          AND JSON_UNQUOTE(JSON_EXTRACT(knowledge_points, CONCAT('$[', numbers.n, ']'))) IS NOT NULL
        ORDER BY knowledge_point`
    )
    return (rows as any[]).map(r => r.knowledge_point).filter((p: string | null) => !!p && p !== 'null')
  },
}
