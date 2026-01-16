import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { IResult, ResultListData, ResultDetail, QuestionResultRow } from '../domain/result.model.js'

function normalizeStatusFilter(status?: string): string[] | null {
    if (!status) return null
    const s = String(status).toLowerCase()
    if (s === 'completed') return ['completed', 'submitted', 'graded']
    if (s === 'in_progress') return ['in_progress']
    if (s === 'not_started') return ['not_started']
    return [s]
}

// 轻量解析 options（纯字符串数组；不动“subject”字段）
function parseOptionsLoose(input: any): string[] | null {
    const toLabel = (x: any) => (x == null ? '' : (typeof x === 'string' ? x : (x?.content ?? x?.label ?? String(x))))
    if (input == null) return null
    if (Array.isArray(input)) {
        const arr = input.map(toLabel).map(s => String(s).trim()).filter(Boolean)
        return arr.length ? arr : null
    }
    let s = String(input).trim()
    if (!s) return null
    try { const v = JSON.parse(s); if (Array.isArray(v)) return v.map(toLabel).map(String).map(x => x.trim()).filter(Boolean) } catch {}
    try { const v = JSON.parse(s.replace(/'/g, '"')); if (Array.isArray(v)) return v.map(toLabel).map(String).map(x => x.trim()).filter(Boolean) } catch {}
    const parts = s.split(/\r?\n|[|,;，、]\s*/g).map(x => x.trim()).filter(Boolean)
    return parts.length ? parts : null
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
            userId, role, page, limit,
            search = '', status = '', sort = 'created_at',
            paperId = '', includeStudentInfo,
        } = params

        const offset = (page - 1) * limit
        const sortField = ['created_at', 'score', 'start_time', 'end_time'].includes(sort) ? sort : 'created_at'
        const sortExpr = sortField === 'end_time' ? 'r.submit_time' : `r.${sortField}`

        const vals: any[] = []
        let where = role === 'student' ? 'WHERE r.user_id = ?' : 'WHERE 1=1'
        if (role === 'student') vals.push(userId)

        const paperIdExpr = 'COALESCE(r.paper_id, e.paper_id)'

        if (search) {
            if (includeStudentInfo) {
                where += ' AND (COALESCE(p.title, \'\') LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)'
                vals.push(`%${search}%`, `%${search}%`, `%${search}%`)
            } else {
                where += ' AND COALESCE(p.title, \'\') LIKE ?'
                vals.push(`%${search}%`)
            }
        }

        const normalized = normalizeStatusFilter(status)
        if (normalized?.length) {
            where += ` AND r.status IN (${normalized.map(() => '?').join(',')})`
            vals.push(...normalized)
        }

        if (paperId) { where += ` AND ${paperIdExpr} = ?`; vals.push(paperId) }

        let join = `
      LEFT JOIN exams e ON r.exam_id = e.id
      LEFT JOIN papers p ON p.id = ${paperIdExpr}
    `
        if (includeStudentInfo) join += ' LEFT JOIN users u ON r.user_id = u.id'

        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM exam_results r ${join} ${where}`, vals
        )
        const total = Number((countRows[0] as any)?.total || 0)

        const selectBase = `
      r.id, r.user_id, r.exam_id,
      ${paperIdExpr} AS paper_id,
      COALESCE(p.title, '') AS paper_title,
      r.score, COALESCE(p.total_score, 0) AS total_score,
      CASE WHEN COALESCE(p.total_score, 0) > 0
           THEN ROUND((r.score / p.total_score * 100), 1)
           ELSE NULL END AS percentage,
      r.start_time, r.submit_time AS end_time,
      TIMESTAMPDIFF(SECOND, r.start_time, r.submit_time) AS duration,
      r.status, r.created_at, r.updated_at
    `
        const select = includeStudentInfo
            ? `${selectBase}, u.nickname AS student_name, u.email AS student_email`
            : selectBase

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT ${select}
             FROM exam_results r
                 ${join}
                 ${where}
             ORDER BY ${sortExpr} DESC
                 LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        )

        return {
            results: rows as unknown as IResult[],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }
    }

    /** 详情：基础信息 + 题目、作答、判定 */
    static async getDetailById(
        user: { id?: number; role?: string } | undefined,
        id: number
    ): Promise<ResultDetail | null> {
        const paperIdExpr = 'COALESCE(r.paper_id, e.paper_id)'
        const isStudent = user?.role === 'student'
        const params: any[] = [id]
        let where = 'WHERE r.id = ?'
        if (isStudent) {
            if (!user?.id) return null
            where += ' AND r.user_id = ?'
            params.push(user.id)
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                 r.id, r.user_id, r.exam_id,
                 ${paperIdExpr} AS paper_id,
                 COALESCE(p.title, '') AS paper_title,
                 r.score, COALESCE(p.total_score, 0) AS total_score,
                 r.answers,
                 r.start_time, r.submit_time AS end_time,
                 TIMESTAMPDIFF(SECOND, r.start_time, r.submit_time) AS duration,
                 r.status, r.created_at, r.updated_at,
                 CASE WHEN COALESCE(p.total_score, 0) > 0
                          THEN ROUND((r.score / p.total_score * 100), 1)
                      ELSE NULL END AS percentage
             FROM exam_results r
                      LEFT JOIN exams e ON r.exam_id = e.id
                      LEFT JOIN papers p ON p.id = ${paperIdExpr}
             ${where}`,
            params
        )
        const base = (rows as any[])[0]
        if (!base) return null

        const paperId = Number(base.paper_id)
        const examResultId = Number(base.id)

        const [qs] = await pool.query<RowDataPacket[]>(
            `SELECT 
          q.id AS q_id,
          q.question_type AS q_type,
          q.content AS q_content,
          q.options AS q_options,
          q.correct_answer AS correct_answer,
          pq.score AS pq_score,
          pq.\`order\` AS pq_order,
          ar.user_answer AS user_answer,
          ar.is_correct AS is_correct
       FROM paper_questions pq
       JOIN questions q ON q.id = pq.question_id
       LEFT JOIN answer_records ar 
              ON ar.exam_result_id = ? AND ar.question_id = q.id
       WHERE pq.paper_id = ?
       ORDER BY pq.\`order\` ASC`,
            [examResultId, paperId]
        )

        const normalizeType = (t?: string) => {
            const s = String(t || '').toLowerCase()
            if (['single', 'single_choice', 'radio', 'sc'].includes(s)) return 'single_choice'
            if (['multiple', 'multiple_choice', 'checkbox', 'mc'].includes(s)) return 'multiple_choice'
            if (['true_false', 'judge', 'tf'].includes(s)) return 'true_false'
            if (['short', 'short_answer', 'essay', 'text', 'fill_blank'].includes(s)) return 'short_answer'
            return s || 'single_choice'
        }

        const questions: QuestionResultRow[] = (qs as any[]).map(r => ({
            id: Number(r.q_id),
            type: normalizeType(r.q_type),
            content: String(r.q_content ?? ''),
            options: parseOptionsLoose(r.q_options),
            score: Number(r.pq_score || 0),
            order: Number(r.pq_order || 0),
            user_answer: r.user_answer == null ? null : String(r.user_answer),
            correct_answer: r.correct_answer == null ? null : String(r.correct_answer),
            is_correct: r.is_correct == null ? null : (Number(r.is_correct) ? 1 : 0),
        }))

        return { ...(base as any), questions }
    }

    /** 老实现（仅基础信息），供兼容 */
    static async getById(user: { id?: number; role?: string } | undefined, id: number) {
        const isStudent = user?.role === 'student'
        const params: any[] = [id]
        let where = 'WHERE r.id = ?'
        if (isStudent) {
            if (!user?.id) return null
            where += ' AND r.user_id = ?'
            params.push(user.id)
        }
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
          r.id, r.user_id, r.exam_id,
          COALESCE(r.paper_id, e.paper_id) AS paper_id,
          COALESCE(p.title, '') AS paper_title,
          r.score, COALESCE(p.total_score, 0) AS total_score,
          r.answers,
          r.start_time, r.submit_time AS end_time,
          TIMESTAMPDIFF(SECOND, r.start_time, r.submit_time) AS duration,
          r.status, r.created_at, r.updated_at
       FROM exam_results r
       LEFT JOIN exams e ON r.exam_id = e.id
       LEFT JOIN papers p ON p.id = COALESCE(r.paper_id, e.paper_id)
       ${where}`,
            params
        )
        return (rows as any[])[0] ?? null
    }
}
