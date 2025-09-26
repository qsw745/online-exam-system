import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2/promise'

export type DateParams = { start_date?: string | null; end_date?: string | null; subject?: string | null }

/* ============ 信息架构探测工具 ============ */
async function hasTable(table: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
        [table]
    )
    return rows.length > 0
}
async function hasColumn(table: string, column: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
        [table, column]
    )
    return rows.length > 0
}

/** 用 exam_results.submit_time 做区间过滤；没有就不加时间条件 */
async function dateWhereER(params: DateParams) {
    const ok = await hasColumn('exam_results', 'submit_time').catch(() => false)
    if (!ok) return { sql: '', args: [] as any[] }
    const wh: string[] = []
    const args: any[] = []
    if (params.start_date) {
        wh.push(`er.submit_time >= ?`)
        args.push(params.start_date + ' 00:00:00')
    }
    if (params.end_date) {
        wh.push(`er.submit_time <= ?`)
        args.push(params.end_date + ' 23:59:59')
    }
    return { sql: wh.length ? ` AND ${wh.join(' AND ')}` : '', args }
}

export class AnalyticsRepository {
    /** 科目列表：当前你的库没有任何学科字段 => 返回空数组（前端显示“全部科目”） */
    async getSubjects(): Promise<string[]> {
        return []
    }

    /** 概览 */
    async getOverview(params: DateParams) {
        const d = await dateWhereER(params)

        // 总学生数：优先 role='student'，否则全量 users
        let totalStudents = 0
        try {
            const [u1] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM users WHERE role='student'`)
            totalStudents = Number((u1[0] as any)?.n || 0)
            if (!totalStudents) throw new Error('fallback')
        } catch {
            const [u2] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM users`)
            totalStudents = Number((u2[0] as any)?.n || 0)
        }

        // 区间内出现过的考试数
        const [exams] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT er.exam_id) AS n
             FROM exam_results er
             WHERE 1=1 ${d.sql}`,
            d.args
        )
        const totalExams = Number((exams[0] as any)?.n || 0)

        // 活跃学生（提交过）
        const [actives] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT er.user_id) AS n
             FROM exam_results er
             WHERE er.status='submitted' ${d.sql}`,
            d.args
        )
        const activeStudents = Number((actives[0] as any)?.n || 0)

        // 题目数：有 questions 就 count(*)，否则 0
        let totalQuestions = 0
        if (await hasTable('questions').catch(() => false)) {
            const [q] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM questions`)
            totalQuestions = Number((q[0] as any)?.n || 0)
        }

        // 平均分（submitted）
        const [avg] = await pool.query<RowDataPacket[]>(
            `SELECT AVG(er.score) AS v
             FROM exam_results er
             WHERE er.status='submitted' ${d.sql}`,
            d.args
        )
        const avgScore = Number((avg[0] as any)?.v || 0)

        // 完成率
        const [done] = await pool.query<RowDataPacket[]>(
            `SELECT
                 SUM(CASE WHEN er.status='submitted' THEN 1 ELSE 0 END) AS submitted_count,
                 COUNT(*) AS total_count
             FROM exam_results er
             WHERE 1=1 ${d.sql}`,
            d.args
        )
        const submitted = Number((done[0] as any)?.submitted_count || 0)
        const total = Number((done[0] as any)?.total_count || 0)
        const completionRate = total ? (submitted / total) * 100 : 0

        return {
            total_students: totalStudents,
            total_questions: totalQuestions,
            total_exams: totalExams,
            avg_score: Number(avgScore.toFixed(1)),
            completion_rate: Number(completionRate.toFixed(1)),
            active_students: activeStudents,
        }
    }

    /** 科目维度：当前无学科列 => 聚合为“未分组”一行 */
    async getSubjectsStats(params: DateParams) {
        const d = await dateWhereER(params)

        const [r] = await pool.query<RowDataPacket[]>(
            `
                SELECT
                    AVG(CASE WHEN er.status='submitted' THEN er.score END) AS avg_score,
                    SUM(CASE WHEN er.status='submitted' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0) AS completion_rate
                FROM exam_results er
                WHERE 1=1 ${d.sql}
            `,
            d.args
        )
        const avg = Number(Number((r[0] as any)?.avg_score || 0).toFixed(1))
        const rate = Number(Number((r[0] as any)?.completion_rate || 0).toFixed(1))

        // 题目数量：同 overview
        let questions = 0
        if (await hasTable('questions').catch(() => false)) {
            const [q] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM questions`)
            questions = Number((q[0] as any)?.n || 0)
        }

        return [
            {
                subject: '未分组',
                questions_count: questions,
                avg_score: avg,
                completion_rate: rate,
            },
        ]
    }

    /** 学生榜单 */
    async getStudents(params: DateParams) {
        const d = await dateWhereER(params)

        const [rows] = await pool.query<RowDataPacket[]>(
            `
                SELECT
                    u.id AS user_id,
                    u.username AS username,
                    AVG(CASE WHEN er.status='submitted' THEN er.score END) AS avg_score,
                    SUM(CASE WHEN er.status='submitted' THEN 1 ELSE 0 END) AS exams_completed,
                    SUM(CASE WHEN er.status='submitted' THEN er.score ELSE 0 END) AS total_score,
                    SUM(COALESCE(er.time_spent, 0)) AS time_spent_sec,
                    MAX(er.submit_time) AS last_active
                FROM users u
                         JOIN exam_results er ON er.user_id = u.id
                WHERE 1=1 ${d.sql}
                GROUP BY u.id, u.username
                ORDER BY (AVG(CASE WHEN er.status='submitted' THEN er.score END) IS NULL) ASC,
                    AVG(CASE WHEN er.status='submitted' THEN er.score END) DESC
            `,
            d.args
        )

        return rows.map(r => ({
            user_id: (r as any).user_id,
            username: (r as any).username ?? `用户${(r as any).user_id}`,
            avg_score: Number(Number((r as any).avg_score ?? 0).toFixed(1)),
            exams_completed: Number((r as any).exams_completed || 0),
            total_score: Number(Number((r as any).total_score ?? 0).toFixed(1)),
            study_time: Math.floor(Number((r as any).time_spent_sec || 0) / 60),
            last_active: (r as any).last_active || null,
        }))
    }

    /** 成绩分布（grade-stats）：A/B/C/D/F 桶 + 及格率 + 平均分 */
    async getGradeStats(params: DateParams) {
        const d = await dateWhereER(params)

        const [rows] = await pool.query<RowDataPacket[]>(
            `
        SELECT
          SUM(CASE WHEN er.status='submitted' AND er.score >= 90 THEN 1 ELSE 0 END) AS a_cnt,
          SUM(CASE WHEN er.status='submitted' AND er.score >= 80 AND er.score < 90 THEN 1 ELSE 0 END) AS b_cnt,
          SUM(CASE WHEN er.status='submitted' AND er.score >= 70 AND er.score < 80 THEN 1 ELSE 0 END) AS c_cnt,
          SUM(CASE WHEN er.status='submitted' AND er.score >= 60 AND er.score < 70 THEN 1 ELSE 0 END) AS d_cnt,
          SUM(CASE WHEN er.status='submitted' AND er.score < 60 THEN 1 ELSE 0 END) AS f_cnt,
          SUM(CASE WHEN er.status='submitted' AND er.score >= 60 THEN 1 ELSE 0 END) AS pass_cnt,
          COUNT(CASE WHEN er.status='submitted' THEN 1 END) AS total_submitted,
          AVG(CASE WHEN er.status='submitted' THEN er.score END) AS avg_score
        FROM exam_results er
        WHERE 1=1 ${d.sql}
      `,
            d.args
        )

        const r = rows[0] as any
        const total = Number(r?.total_submitted || 0)
        const avg = Number(Number(r?.avg_score || 0).toFixed(1))

        const buckets = [
            { key: 'A', label: '90~100', count: Number(r?.a_cnt || 0) },
            { key: 'B', label: '80~89', count: Number(r?.b_cnt || 0) },
            { key: 'C', label: '70~79', count: Number(r?.c_cnt || 0) },
            { key: 'D', label: '60~69', count: Number(r?.d_cnt || 0) },
            { key: 'F', label: '0~59',  count: Number(r?.f_cnt || 0) },
        ]

        const passRate = total ? Number(((Number(r?.pass_cnt || 0) / total) * 100).toFixed(1)) : 0

        return { total, average: avg, pass_rate: passRate, buckets }
    }
}
