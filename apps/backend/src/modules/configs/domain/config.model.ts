import type { RowDataPacket } from 'mysql2/promise'

export interface SystemConfig extends RowDataPacket {
  id: number
  config_key: string
  config_name: string
  config_value: string | null
  value_type: string
  enabled: number
  description?: string | null
  created_at: Date
  updated_at: Date
}
