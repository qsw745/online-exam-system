import type { RowDataPacket } from 'mysql2'

export interface LogQueryParams {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  level?: string
  module?: string
  action?: string
  userId?: number
  username?: string
}

export interface LogRow extends RowDataPacket {
  id: number
  log_type: string
  level: string | null
  user_id: number | null
  username: string | null
  action: string | null
  resource_type?: string | null
  resource?: string | null
  message: string | null
  details: string | null
  ip_address: string | null
  user_agent?: string | null
  status: string | null
  created_at: string
}
