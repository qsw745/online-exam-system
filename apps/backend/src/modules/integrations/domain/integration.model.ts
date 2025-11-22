import type { RowDataPacket } from 'mysql2/promise'

export interface Integration extends RowDataPacket {
  id: number
  name: string
  type: string
  endpoint?: string | null
  config?: any
  enabled: number
  description?: string | null
  created_at: Date
  updated_at: Date
}
