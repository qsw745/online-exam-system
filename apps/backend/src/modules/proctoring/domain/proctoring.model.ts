export type ProctoringSeverity = 'info' | 'warn' | 'critical'

export type ProctoringEventInput = {
  examId: number
  taskId?: number
  type: string
  severity?: ProctoringSeverity
  message?: string
  meta?: any
  occurredAt?: string
  source?: string
}

export type ProctoringEvent = {
  id: number
  exam_id: number
  user_id: number
  severity: ProctoringSeverity
  type: string
  message: string | null
  meta?: any
  occurred_at?: string | null
  created_at: string
}

export type ProctoringSummary = {
  total: number
  info: number
  warn: number
  critical: number
}

export type ProctoringListResult = {
  items: ProctoringEvent[]
  total: number
  page: number
  limit: number
  summary: ProctoringSummary
}
