import { pool } from '../config/database.js';
import { ResultSetHeader } from 'mysql2';

export interface UserLogData {
  userId: number;
  action: string;
  resourceType?: string;
  resourceId?: number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface SystemLogData {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  module: string;
  message: string;
  details?: any;
  stackTrace?: string;
}

export interface AuditLogData {
  userId?: number;
  action: string;
  tableName?: string;
  recordId?: number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginLogData {
  userId?: number;
  username: string;
  status: 'success' | 'failed';
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ExamLogData {
  examId: number;
  userId: number;
  action: 'start' | 'pause' | 'resume' | 'submit' | 'timeout' | 'answer_change';
  questionId?: number;
  oldAnswer?: string;
  newAnswer?: string;
  timestampOffset?: number;
}

export class LoggerService {
  // 记录用户操作日志（统一日志表）
  static async logUserAction(data: UserLogData): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO logs (log_type, level, user_id, username, action, resource_type, resource_id, details, ip_address, user_agent) 
         VALUES ('user', 'info', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.userId,
          data.username || null,
          data.action,
          data.resourceType || null,
          data.resourceId || null,
          data.details ? JSON.stringify(data.details) : null,
          data.ipAddress || null,
          data.userAgent || null
        ]
      );
    } catch (error) {
      console.error('记录用户操作日志失败:', error);
    }
  }

  // 记录系统日志（统一日志表）
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
          data.details ? JSON.stringify(data.details) : null
        ]
      );
      
      // 同时输出到控制台
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${data.level.toUpperCase()}] [${data.module}] ${data.message}`;
      
      switch (data.level) {
        case 'error':
        case 'fatal':
          console.error(logMessage, data.details || '');
          if (data.stackTrace) console.error(data.stackTrace);
          break;
        case 'warn':
          console.warn(logMessage, data.details || '');
          break;
        case 'debug':
          console.debug(logMessage, data.details || '');
          break;
        default:
          console.log(logMessage, data.details || '');
      }
    } catch (error) {
      console.error('记录系统日志失败:', error);
    }
  }

  // 记录审计日志（统一日志表）
  static async logAudit(data: AuditLogData): Promise<void> {
    try {
      const details = {
        tableName: data.tableName,
        recordId: data.recordId,
        oldValues: data.oldValues,
        newValues: data.newValues
      };
      
      await pool.query(
        `INSERT INTO logs (log_type, level, user_id, username, action, resource_type, resource_id, details, ip_address, user_agent) 
         VALUES ('audit', 'info', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.userId || null,
          data.username || null,
          data.action,
          data.tableName || null,
          data.recordId || null,
          JSON.stringify(details),
          data.ipAddress || null,
          data.userAgent || null
        ]
      );
    } catch (error) {
      console.error('记录审计日志失败:', error);
    }
  }

  // 记录登录日志（统一日志表）
  static async logLogin(data: LoginLogData): Promise<void> {
    try {
      const details = {
        status: data.status,
        failureReason: data.failureReason
      };
      
      await pool.query(
        `INSERT INTO logs (log_type, level, user_id, username, action, resource_type, message, details, ip_address, user_agent) 
         VALUES ('login', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.status === 'success' ? 'info' : 'error',
          data.userId || null,
          data.username,
          'login',
          'auth',
          data.status === 'success' ? 'User login successful' : 'User login failed',
          JSON.stringify(details),
          data.ipAddress || null,
          data.userAgent || null
        ]
      );
    } catch (error) {
      console.error('记录登录日志失败:', error);
    }
  }

  // 记录考试日志
  static async logExam(data: ExamLogData): Promise<void> {
    try {
      const details = {
        examId: data.examId,
        questionId: data.questionId,
        oldAnswer: data.oldAnswer,
        newAnswer: data.newAnswer,
        timestampOffset: data.timestampOffset
      };
      
      await pool.query(
        `INSERT INTO logs (log_type, level, user_id, action, resource_type, message, details, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          'exam',
          'info',
          data.userId,
          data.action,
          'exam',
          `Exam action: ${data.action}`,
          JSON.stringify(details)
        ]
      );
    } catch (error) {
      console.error('记录考试日志失败:', error);
    }
  }

  // 便捷方法：记录信息日志
  static info(module: string, message: string, details?: any): void {
    this.logSystem({ level: 'info', module, message, details });
  }

  // 便捷方法：记录警告日志
  static warn(module: string, message: string, details?: any): void {
    this.logSystem({ level: 'warn', module, message, details });
  }

  // 便捷方法：记录错误日志
  static error(module: string, message: string, error?: Error, details?: any): void {
    this.logSystem({
      level: 'error',
      module,
      message,
      details,
      stackTrace: error?.stack
    });
  }

  // 便捷方法：记录调试日志
  static debug(module: string, message: string, details?: any): void {
    this.logSystem({ level: 'debug', module, message, details });
  }

  // 清理过期日志
  static async cleanupLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM logs WHERE created_at < ?`,
        [cutoffDate]
      );
      
      this.info('logger', '清理logs表过期日志', { deletedRows: result.affectedRows });
    } catch (error) {
      this.error('logger', '清理过期日志失败', error as Error);
    }
  }
}

// 导出便捷的日志记录函数
// 导出便捷函数
export const logUserAction = LoggerService.logUserAction.bind(LoggerService);
export const logSystemLog = LoggerService.logSystem.bind(LoggerService);
export const logAudit = LoggerService.logAudit.bind(LoggerService);
export const logLogin = LoggerService.logLogin.bind(LoggerService);
export const logExam = LoggerService.logExam.bind(LoggerService);

export const logger = {
  info: LoggerService.info.bind(LoggerService),
  warn: LoggerService.warn.bind(LoggerService),
  error: LoggerService.error.bind(LoggerService),
  debug: LoggerService.debug.bind(LoggerService),
  userAction: LoggerService.logUserAction.bind(LoggerService),
  audit: LoggerService.logAudit.bind(LoggerService),
  login: LoggerService.logLogin.bind(LoggerService),
  exam: LoggerService.logExam.bind(LoggerService)
};