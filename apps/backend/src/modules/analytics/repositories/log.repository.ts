import { pool } from '@/config/database'
import type { ResultSetHeader } from 'mysql2/promise'

export interface UserLogRow {
  userId?: number
  username?: string
  action: string
  resourceType?: string
  resourceId?: number
  details?: any
  ipAddress?: string
  userAgent?: string
}

export interface SystemLogRow {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  module: string
  message: string
  details?: any
  stackTrace?: string
}

export interface AuditLogRow {
  userId?: number
  username?: string
  action: string
  tableName?: string
  recordId?: number
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
}

export interface LoginLogRow {
  userId?: number
  username: string
  status: 'success' | 'failed'
  failureReason?: string
  ipAddress?: string
  userAgent?: string
}

export interface ExamLogRow {
  examId: number
  userId: number
  action: 'start' | 'pause' | 'resume' | 'submit' | 'timeout' | 'answer_change'
  questionId?: number
  oldAnswer?: string
  newAnswer?: string
  timestampOffset?: number
}

export const LogRepository = {
  async insertUserLog(data: UserLogRow): Promise<void> {
    await pool.query(
      `INSERT INTO logs (log_type, level, user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ('user', 'info', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId ?? null,
        data.username ?? null,
        data.action,
        data.resourceType ?? null,
        data.resourceId ?? null,
        data.details ? JSON.stringify(data.details) : null,
        data.ipAddress ?? null,
        data.userAgent ?? null,
      ]
    )
  },

  async insertSystemLog(data: SystemLogRow): Promise<void> {
    await pool.query(
      `INSERT INTO logs (log_type, level, action, resource_type, message, details)
       VALUES ('system', ?, ?, ?, ?, ?)`,
      [
        data.level,
        data.module || 'system',
        data.module,
        data.message,
        data.details ? JSON.stringify(data.details) : null,
      ]
    )
  },

  async insertAuditLog(data: AuditLogRow): Promise<void> {
    const details = {
      tableName: data.tableName,
      recordId: data.recordId,
      oldValues: data.oldValues,
      newValues: data.newValues,
    }
    await pool.query(
      `INSERT INTO logs (log_type, level, user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ('audit', 'info', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId ?? null,
        data.username ?? null,
        data.action,
        data.tableName ?? null,
        data.recordId ?? null,
        JSON.stringify(details),
        data.ipAddress ?? null,
        data.userAgent ?? null,
      ]
    )
  },

  async insertLoginLog(data: LoginLogRow): Promise<void> {
    const details = { status: data.status, failureReason: data.failureReason }
    await pool.query(
      `INSERT INTO logs (log_type, level, user_id, username, action, resource_type, message, details, ip_address, user_agent)
       VALUES ('login', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.status === 'success' ? 'info' : 'error',
        data.userId ?? null,
        data.username,
        'login',
        'auth',
        data.status === 'success' ? 'User login successful' : 'User login failed',
        JSON.stringify(details),
        data.ipAddress ?? null,
        data.userAgent ?? null,
      ]
    )
  },

  async insertExamLog(data: ExamLogRow): Promise<void> {
    const details = {
      examId: data.examId,
      questionId: data.questionId,
      oldAnswer: data.oldAnswer,
      newAnswer: data.newAnswer,
      timestampOffset: data.timestampOffset,
    }
    await pool.query(
      `INSERT INTO logs (log_type, level, user_id, action, resource_type, message, details, created_at)
       VALUES ('exam', 'info', ?, ?, 'exam', ?, ?, NOW())`,
      [data.userId, data.action, `Exam action: ${data.action}`, JSON.stringify(details)]
    )
  },

  async cleanupOlderThan(cutoff: Date): Promise<number> {
    const [ret] = await pool.query<ResultSetHeader>(`DELETE FROM logs WHERE created_at < ?`, [cutoff])
    return (ret as ResultSetHeader).affectedRows
  },
}

export default LogRepository
