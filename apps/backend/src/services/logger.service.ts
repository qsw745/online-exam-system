import { pool } from '@config/database.js'
import { ResultSetHeader } from 'mysql2'
import { appLogger } from '@infrastructure/logging/logger.js' // ✅ 用真正的 appLogger（winston 实例），别再用 reqLogger 了

export interface UserLogData {
  userId?: number
  username?: string
  action: string
  resourceType?: string
  resourceId?: number
  details?: any
  ipAddress?: string
  userAgent?: string
}

export interface SystemLogData {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  module: string
  message: string
  details?: any
  stackTrace?: string
}

export interface AuditLogData {
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

export interface LoginLogData {
  userId?: number
  username: string
  status: 'success' | 'failed'
  failureReason?: string
  ipAddress?: string
  userAgent?: string
}

export interface ExamLogData {
  examId: number
  userId: number
  action: 'start' | 'pause' | 'resume' | 'submit' | 'timeout' | 'answer_change'
  questionId?: number
  oldAnswer?: string
  newAnswer?: string
  timestampOffset?: number
}

export class LoggerService {
  static async logUserAction(data: UserLogData): Promise<void> {
    try {
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
    } catch (error) {
      appLogger.error('记录用户操作日志失败', { error, data })
    }
  }

  static async logSystem(data: SystemLogData): Promise<void> {
    try {
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

      const meta = { module: data.module, details: data.details, stackTrace: data.stackTrace }
      switch (data.level) {
        case 'fatal':
          appLogger.error(`[FATAL] ${data.module}: ${data.message}`, meta)
          break
        case 'error':
          appLogger.error(`${data.module}: ${data.message}`, meta)
          break
        case 'warn':
          appLogger.warn(`${data.module}: ${data.message}`, meta)
          break
        case 'debug':
          appLogger.debug(`${data.module}: ${data.message}`, meta)
          break
        default:
          appLogger.info(`${data.module}: ${data.message}`, meta)
      }
    } catch (error) {
      appLogger.error('记录系统日志失败', { error, data })
    }
  }

  static async logAudit(data: AuditLogData): Promise<void> {
    try {
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
    } catch (error) {
      appLogger.error('记录审计日志失败', { error, data })
    }
  }

  static async logLogin(data: LoginLogData): Promise<void> {
    try {
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
    } catch (error) {
      appLogger.error('记录登录日志失败', { error, data })
    }
  }

  static async logExam(data: ExamLogData): Promise<void> {
    try {
      const details = {
        examId: data.examId,
        questionId: data.questionId,
        oldAnswer: data.oldAnswer,
        newAnswer: data.newAnswer,
        timestampOffset: data.timestampOffset,
      }
      await pool.query(
        `INSERT INTO logs (log_type, level, user_id, action, resource_type, message, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        ['exam', 'info', data.userId, data.action, 'exam', `Exam action: ${data.action}`, JSON.stringify(details)]
      )
    } catch (error) {
      appLogger.error('记录考试日志失败', { error, data })
    }
  }

  static info(module: string, message: string, details?: any): void {
    this.logSystem({ level: 'info', module, message, details })
  }
  static warn(module: string, message: string, details?: any): void {
    this.logSystem({ level: 'warn', module, message, details })
  }
  static error(module: string, message: string, error?: Error, details?: any): void {
    this.logSystem({ level: 'error', module, message, details, stackTrace: error?.stack })
  }
  static debug(module: string, message: string, details?: any): void {
    this.logSystem({ level: 'debug', module, message, details })
  }

  static async cleanupLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const [result] = await pool.query<ResultSetHeader>(`DELETE FROM logs WHERE created_at < ?`, [cutoffDate])
      this.info('logger', '清理logs表过期日志', { deletedRows: (result as ResultSetHeader).affectedRows })
    } catch (error) {
      this.error('logger', '清理过期日志失败', error as Error)
    }
  }
}

// 保持原导出 API（不影响你已有调用）
export const logUserAction = LoggerService.logUserAction.bind(LoggerService)
export const logSystemLog = LoggerService.logSystem.bind(LoggerService)
export const logAudit = LoggerService.logAudit.bind(LoggerService)
export const logLogin = LoggerService.logLogin.bind(LoggerService)
export const logExam = LoggerService.logExam.bind(LoggerService)

export const logger = {
  info: LoggerService.info.bind(LoggerService),
  warn: LoggerService.warn.bind(LoggerService),
  error: LoggerService.error.bind(LoggerService),
  debug: LoggerService.debug.bind(LoggerService),
  userAction: LoggerService.logUserAction.bind(LoggerService),
  audit: LoggerService.logAudit.bind(LoggerService),
  login: LoggerService.logLogin.bind(LoggerService),
  exam: LoggerService.logExam.bind(LoggerService),
}
