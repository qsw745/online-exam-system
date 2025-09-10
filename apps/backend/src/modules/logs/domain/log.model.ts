import type { RowDataPacket } from 'mysql2'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogType = 'user' | 'system' | 'audit' | 'login' | 'exam'

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
  type: LogType
  action?: string
  message?: string
  details?: any
  level?: LogLevel // 可选；未提供则自动推断
  status?: 'success' | 'failed' | string
  userId?: number
  username?: string
  resourceType?: string
  resourceId?: number
  ipAddress?: string
  userAgent?: string
}

/** 考试行为（读取 exam_logs 用） */
export type ExamLogRow = RowDataPacket & {
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
