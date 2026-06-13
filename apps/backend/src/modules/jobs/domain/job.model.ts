import type { RowDataPacket } from 'mysql2/promise'

export interface SchedulerJob extends RowDataPacket {
  id: number
  name: string
  cron: string
  handler: string
  status: string
  last_run_at?: Date | null
  next_run_at?: Date | null
  description?: string | null
  meta?: any
  created_at: Date
  updated_at: Date
}
