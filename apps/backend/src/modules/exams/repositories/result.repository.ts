// src/modules/exams/repositories/result.repository.ts
import { pool } from '@config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { IResult, ResultListData } from '../domain/result.model.js'

export class ResultRepository {
  static async list(params: {
    userId: number
    role?: string
    page: number
    limit: number
    search?: string
    status?: string
    sort?: 'created_at' | 'score' | 'start_time' | 'end_time'
    paperId?: string
    includeStudentInfo?: boolean
  }): Promise<ResultListData> {
    const {
      userId,
      role,
      page,
      limit,
      search = '',
      status = '',
      sort = 'created_at',
      paperId = '',
      includeStudentInfo,
    } = params

    const offset = (page - 1) * limit
    const allowedSortFields = ['created_at', 'score', 'start_time', 'end_time']
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at'

    let where = ''
    const vals: any[] = []
    if (role === 'student') {
      where = 'WHERE r.user_id = ?'
      vals.push(userId)
    } else {
      where = 'WHERE 1=1'
    }

    if (search) {
      if (includeStudentInfo) {
        where += ' AND (p.title LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)'
        vals.push(`%${search}%`, `%${search}%`, `%${search}%`)
      } else {
        where += ' AND p.title LIKE ?'
        vals.push(`%${search}%`)
      }
    }
    if (status) {
      where += ' AND r.status = ?'
      vals.push(status)
    }
    if (paperId) {
      where += ' AND r.paper_id = ?'
      vals.push(paperId)
    }

    let join = 'JOIN papers p ON r.paper_id = p.id'
    if (includeStudentInfo) join += ' JOIN users u ON r.user_id = u.id'

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM exam_results r ${join} ${where}`,
      vals
    )
    const total = Number((countRows[0] as any)?.total || 0)

    let select = `
      r.id, r.user_id, r.paper_id, p.title as paper_title, r.score, p.total_score,
      ROUND((r.score / p.total_score * 100), 1) as percentage,
      r.start_time, r.submit_time as end_time, TIMESTAMPDIFF(SECOND, r.start_time, r.submit_time) as duration,
      r.status, r.created_at, r.updated_at`
    if (includeStudentInfo) select += `, u.nickname as student_name, u.email as student_email`

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${select} FROM exam_results r ${join} ${where} ORDER BY r.${sortField} DESC LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    )

    return {
      results: rows as unknown as IResult[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  static async getByIdOwned(userId: number, id: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.paper_id, p.title as paper_title, r.score, p.total_score, r.answers,
              r.start_time, r.submit_time as end_time, r.status, r.created_at, r.updated_at
         FROM exam_results r JOIN papers p ON r.paper_id = p.id
        WHERE r.id = ? AND r.user_id = ?`,
      [id, userId]
    )
    return (rows as any[])[0] ?? null
  }
}
