// apps/backend/src/modules/logs/domain/log.model.ts
import type { RowDataPacket } from 'mysql2'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogType = 'user' | 'system' | 'audit' | 'login' | 'exam' | 'organization'

export interface LogRow extends RowDataPacket {
  id: number
  log_type: LogType
  level: LogLevel | null
  user_id: number | null
  username: string | null
  action: string | null
  resource_type: string | null
  resource_id: number | null
  message: string | null
  details: string | null
  ip_address: string | null
  user_agent: string | null
  status: string | null
  created_at: string
}

/** 列表/导出查询参数 */
export interface LogQueryParams {
  page?: number
  limit?: number
  start_date?: string
  end_date?: string
  level?: string
  module?: string
  action?: string
  userId?: number
  username?: string
}

/** 写日志入参（统一口） */
export type LogInput = {
  type?: LogType
  status?: 'success' | 'failed' | 'warn' | string
  level?: LogLevel
  userId?: number
  username?: string
  action?: string
  message?: string
  resourceType?: string
  resourceId?: number
  details?: any
  ipAddress?: string
  userAgent?: string
}

/** 考试行为日志行（exam_logs 联表查询结果） */
export interface ExamLogRow extends RowDataPacket {
  id: number
  exam_id: number
  user_id: number
  action: 'start' | 'pause' | 'resume' | 'submit' | 'timeout' | 'answer_change'
  question_id: number | null
  old_answer: string | null
  new_answer: string | null
  timestamp_offset: number | null
  created_at: string
  username?: string | null
  question_content?: string | null
}
