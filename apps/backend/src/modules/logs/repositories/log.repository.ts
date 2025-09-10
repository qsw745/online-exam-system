import { pool } from '@/config/database'
import type { ResultSetHeader } from 'mysql2/promise'
import type { LogInput, LogQueryParams, LogRow, ExamLogRow } from '../domain/log.model'
import type { RowDataPacket } from 'mysql2'

const J = (v: any) => (v === undefined ? null : JSON.stringify(v))

/** 尽量把 SQL 都放这里：写 + 通用查 + 考试日志查 */
export const LogRepository = {
  /** 单表 logs 通用写入（统一口） */
  async insert(input: LogInput) {
    const sql = `
      INSERT INTO logs
      (log_type, level, user_id, username, action, resource_type, resource_id,
       message, details, ip_address, user_agent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const params = [
      input.type,
      input.level ?? 'info',
      input.userId ?? null,
      input.username ?? null,
      input.action ?? null,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.message ?? null,
      J(input.details),
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.status ?? null,
    ]
    await pool.query<ResultSetHeader>(sql, params)
  },

  /** logs 通用分页查询（控制权限由上层传入 scope） */
  async queryLogs(scope: { currentUserId: number; role?: string }, q: LogQueryParams) {
    const { currentUserId, role } = scope
    const { page = 1, limit = 20, start_date, end_date, level, module, action, userId, username } = q || {}

    const ps: any[] = []
    const cps: any[] = []

    let where = '1=1'
    if (role !== 'admin') {
      where += ' AND (user_id = ? OR log_type = "system" OR (log_type = "login" AND user_id = ?))'
      ps.push(currentUserId, currentUserId)
      cps.push(currentUserId, currentUserId)
    }

    if (level && level !== 'all') {
      where += ' AND level = ?'
      ps.push(level)
      cps.push(level)
    }
    if (module) {
      where += ' AND resource_type = ?'
      ps.push(module)
      cps.push(module)
    }
    if (action) {
      where += ' AND action LIKE ?'
      ps.push(`%${action}%`)
      cps.push(`%${action}%`)
    }
    if (username) {
      where += ' AND username LIKE ?'
      ps.push(`%${username}%`)
      cps.push(`%${username}%`)
    }
    if (typeof userId === 'number') {
      where += ' AND user_id = ?'
      ps.push(userId)
      cps.push(userId)
    }
    if (start_date) {
      where += ' AND created_at >= ?'
      ps.push(start_date)
      cps.push(start_date)
    }
    if (end_date) {
      where += ' AND created_at <= ?'
      ps.push(end_date)
      cps.push(end_date)
    }

    const offset = (Number(page) - 1) * Number(limit)

    const listSql = `
      SELECT id, log_type, level, user_id, username, action,
             resource_type, resource_id, message, details,
             ip_address, user_agent, status, created_at
        FROM logs
       WHERE ${where}
    ORDER BY created_at DESC
       LIMIT ?, ?
    `
    const countSql = `SELECT COUNT(*) as total FROM logs WHERE ${where}`

    const [rows] = await pool.query<RowDataPacket[]>(listSql, [...ps, offset, Number(limit)])
    const [cnt] = await pool.query<RowDataPacket[]>(countSql, cps)
    const total = Number((cnt as any)[0]?.total || 0)
    return { rows: rows as LogRow[], total, page: Number(page), limit: Number(limit) }
  },

  /** 导出（不分页） */
  async exportLogs(scope: { currentUserId: number; role?: string }, q: LogQueryParams) {
    const { currentUserId, role } = scope
    const { start_date, end_date, level, module, action, userId, username } = q || {}
    const ps: any[] = []

    let where = '1=1'
    if (role !== 'admin') {
      where += ' AND (user_id = ? OR log_type = "system")'
      ps.push(currentUserId)
    }
    if (level && level !== 'all') {
      where += ' AND level = ?'
      ps.push(level)
    }
    if (module) {
      where += ' AND resource_type = ?'
      ps.push(module)
    }
    if (action) {
      where += ' AND action LIKE ?'
      ps.push(`%${action}%`)
    }
    if (typeof userId === 'number') {
      where += ' AND user_id = ?'
      ps.push(userId)
    }
    if (username) {
      where += ' AND username LIKE ?'
      ps.push(`%${username}%`)
    }
    if (start_date) {
      where += ' AND created_at >= ?'
      ps.push(start_date)
    }
    if (end_date) {
      where += ' AND created_at <= ?'
      ps.push(end_date)
    }

    const sql = `
      SELECT id, log_type, level, user_id, username, action,
             resource_type, resource_id, message, details,
             ip_address, user_agent, status, created_at
        FROM logs
       WHERE ${where}
    ORDER BY created_at DESC
    `
    const [rows] = await pool.query<RowDataPacket[]>(sql, ps)
    return rows as LogRow[]
  },

  /** exam_logs 查询（JOIN 用户/题干），用于考试行为明细 */
  async queryExamLogs(scope: { currentUserId: number; role?: string }, examId: number, q: LogQueryParams) {
    const { currentUserId, role } = scope
    const { page = 1, limit = 20, start_date, end_date, action, userId } = q || {}
    const ps: any[] = [examId]

    let where = 'el.exam_id = ?'
    if (role !== 'admin' && role !== 'teacher') {
      where += ' AND el.user_id = ?'
      ps.push(currentUserId)
    } else if (typeof userId === 'number') {
      where += ' AND el.user_id = ?'
      ps.push(userId)
    }
    if (start_date) {
      where += ' AND el.created_at >= ?'
      ps.push(start_date)
    }
    if (end_date) {
      where += ' AND el.created_at <= ?'
      ps.push(end_date)
    }
    if (action) {
      where += ' AND el.action = ?'
      ps.push(action)
    }

    const offset = (Number(page) - 1) * Number(limit)

    const listSql = `
      SELECT el.*, u.username, q.content as question_content
        FROM exam_logs el
   LEFT JOIN users u ON el.user_id = u.id
   LEFT JOIN questions q ON el.question_id = q.id
       WHERE ${where}
    ORDER BY el.created_at DESC
       LIMIT ?, ?
    `
    const countSql = `SELECT COUNT(*) as total FROM exam_logs el WHERE ${where}`

    const [rows] = await pool.query<RowDataPacket[]>(listSql, [...ps, offset, Number(limit)])
    const [cnt] = await pool.query<RowDataPacket[]>(countSql, ps)
    const total = Number((cnt as any)[0]?.total || 0)
    return { rows: rows as ExamLogRow[], total, page: Number(page), limit: Number(limit) }
  },

  async cleanupOlderThan(cutoff: Date): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>('DELETE FROM logs WHERE created_at < ?', [cutoff])
    return (ret as ResultSetHeader).affectedRows
  },
}

export default LogRepository
