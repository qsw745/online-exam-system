import type { RowDataPacket } from 'mysql2/promise'

export interface Dictionary extends RowDataPacket {
  id: number
  code: string
  name: string
  description?: string | null
  enabled: number
  sort_order: number
  created_at: Date
  updated_at: Date
}

export interface DictionaryItem extends RowDataPacket {
  id: number
  dict_id: number
  label: string
  value: string
  tag?: string | null
  enabled: number
  sort_order: number
  created_at: Date
  updated_at: Date
}

export type DictionaryWithItems = Dictionary & { items: DictionaryItem[] }
