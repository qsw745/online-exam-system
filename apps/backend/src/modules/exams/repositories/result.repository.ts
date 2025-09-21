import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { IResult, ResultListData } from '../domain/result.model.js'

/** 将前端的筛选值标准化为后端可识别的真实状态集合 */
function normalizeStatusFilter(status?: string): string[] | null {
    if (!status) return null
    const s = String(status).toLowerCase()
    if (s === 'completed') return ['completed', 'submitted', 'graded'] // ✅ 关键映射
    if (s === 'in_progress') return ['in_progress']
    if (s === 'not_started') return ['not_started']
    // 其它直传
    return [s]
}

export class ResultRepository {
    static async list(params: {
        userId: number
        role?: string
        page: number
        limit: number
        search?: string
        status?: string
        sort?: 'created_at' | 'score' | 'start_time' | 'end_time'
        paperId?: string | number
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
        const allowedSortFields = ['created_at', 'score', 'start_time', 'end_time'] as const
        const sortField = (allowedSortFields as readonly string[]).includes(sort) ? sort : 'created_at'

        const vals: any[] = []
        let where = role === 'student' ? 'WHERE r.user_id = ?' : 'WHERE 1=1'
        if (role === 'student') vals.push(userId)

        // 统一的试卷ID表达式：优先结果表，其次考试表
        const paperIdExpr = 'COALESCE(r.paper_id, e.paper_id)'

        // 搜索（兼容 p.title 可能为空）
        if (search) {
            if (includeStudentInfo) {
                where += ' AND (COALESCE(p.title, \'\') LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)'
                vals.push(`%${search}%`, `%${search}%`, `%${search}%`)
            } else {
                where += ' AND COALESCE(p.title, \'\') LIKE ?'
                vals.push(`%${search}%`)
            }
        }

        // 状态过滤（含 completed -> submitted/graded）
        const normalized = normalizeStatusFilter(status)
        if (normalized && normalized.length) {
            where += ` AND r.status IN (${normalized.map(() => '?').join(',')})`
            vals.push(...normalized)
        }

        // 指定试卷过滤：对齐统一表达式
        if (paperId) {
            where += ` AND ${paperIdExpr} = ?`
            vals.push(paperId)
        }

        // ✅ 改为 LEFT JOIN，避免因为 paper_id 为空或试卷不存在而被过滤掉
        let join = `
      LEFT JOIN exams e ON r.exam_id = e.id
      LEFT JOIN papers p ON p.id = ${paperIdExpr}
    `
        if (includeStudentInfo) join += ' LEFT JOIN users u ON r.user_id = u.id'

        // 先算总数
        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM exam_results r ${join} ${where}`,
            vals
        )
        const total = Number((countRows[0] as any)?.total || 0)

        // 避免 total_score 为 0 导致百分比为 NULL；paper_id 使用统一表达式
        const selectBase = `
      r.id,
      r.user_id,
      ${paperIdExpr} as paper_id,
      COALESCE(p.title, '') as paper_title,
      r.score,
      COALESCE(p.total_score, 0) as total_score,
      CASE WHEN COALESCE(p.total_score, 0) > 0
           THEN ROUND((r.score / p.total_score * 100), 1)
           ELSE NULL
      END as percentage,
      r.start_time,
      r.submit_time as end_time,
      TIMESTAMPDIFF(SECOND, r.start_time, r.submit_time) as duration,
      r.status,
      r.created_at,
      r.updated_at
    `
        const select = includeStudentInfo
            ? `${selectBase}, u.nickname as student_name, u.email as student_email`
            : selectBase

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ${select}
             FROM exam_results r
                 ${join}
                 ${where}
             ORDER BY r.${sortField} DESC
                 LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        )

        return {
            results: rows as unknown as IResult[],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }
    }

    static async getByIdOwned(userId: number, id: number) {
        const paperIdExpr = 'COALESCE(r.paper_id, e.paper_id)'
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
          r.id,
          ${paperIdExpr} as paper_id,
          COALESCE(p.title, '') as paper_title,
          r.score,
          COALESCE(p.total_score, 0) as total_score,
          r.answers,
          r.start_time,
          r.submit_time as end_time,
          r.status,
          r.created_at,
          r.updated_at
        FROM exam_results r
        LEFT JOIN exams e ON r.exam_id = e.id
        LEFT JOIN papers p ON p.id = ${paperIdExpr}
       WHERE r.id = ? AND r.user_id = ?`,
            [id, userId]
        )
        return (rows as any[])[0] ?? null
    }
}
