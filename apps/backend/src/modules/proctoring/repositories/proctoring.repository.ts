import { pool } from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import type { ProctoringEvent, ProctoringSeverity, ProctoringSummary } from '../domain/proctoring.model'

type ListParams = {
  examId: number
  userId?: number
  severity?: ProctoringSeverity
  page?: number
  limit?: number
}

const parseDetails = (raw: any) => {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

export const ProctoringRepository = {
  async listByExam(params: ListParams) {
    const { examId, userId, severity, page = 1, limit = 20 } = params
    const ps: any[] = [examId]
    let where = `log_type = 'exam' AND action = 'proctoring' AND resource_type = 'exam' AND resource_id = ?`

    if (typeof userId === 'number') {
      where += ' AND user_id = ?'
      ps.push(userId)
    }
    if (severity) {
      where += ' AND status = ?'
      ps.push(severity)
    }

    const offset = (Number(page) - 1) * Number(limit)

    const listSql = `
      SELECT id, user_id, resource_id AS exam_id, status, level, message, details, created_at
      FROM logs
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ?, ?
    `
    const countSql = `SELECT COUNT(*) as total FROM logs WHERE ${where}`

    const [rows] = await pool.query<RowDataPacket[]>(listSql, [...ps, offset, Number(limit)])
    const [cnt] = await pool.query<RowDataPacket[]>(countSql, ps)
    const total = Number((cnt as any)[0]?.total || 0)

    const items = (rows as RowDataPacket[]).map(row => {
      const details = parseDetails((row as any).details)
      const type = details?.type ? String(details.type) : 'unknown'
      const severityFinal = (row as any).status || (row as any).level || 'info'
      return {
        id: Number((row as any).id),
        exam_id: Number((row as any).exam_id),
        user_id: Number((row as any).user_id || 0),
        severity: severityFinal as ProctoringSeverity,
        type,
        message: (row as any).message ?? null,
        meta: details?.meta ?? details,
        occurred_at: details?.occurredAt ?? null,
        created_at: String((row as any).created_at),
      } as ProctoringEvent
    })

    return { items, total, page: Number(page), limit: Number(limit) }
  },

  async summaryByExam(examId: number, userId?: number): Promise<ProctoringSummary> {
    const ps: any[] = [examId]
    let where = `log_type = 'exam' AND action = 'proctoring' AND resource_type = 'exam' AND resource_id = ?`
    if (typeof userId === 'number') {
      where += ' AND user_id = ?'
      ps.push(userId)
    }

    const sql = `
      SELECT status, COUNT(*) as cnt
      FROM logs
      WHERE ${where}
      GROUP BY status
    `
    const [rows] = await pool.query<RowDataPacket[]>(sql, ps)
    const summary: ProctoringSummary = { total: 0, info: 0, warn: 0, critical: 0 }
    for (const row of rows as RowDataPacket[]) {
      const status = String((row as any).status || 'info')
      const cnt = Number((row as any).cnt || 0)
      summary.total += cnt
      if (status === 'critical') summary.critical += cnt
      else if (status === 'warn') summary.warn += cnt
      else summary.info += cnt
    }
    return summary
  },
}

export default ProctoringRepository
