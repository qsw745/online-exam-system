// apps/backend/src/modules/messages/domain/message.model.ts
import type { RowDataPacket } from 'mysql2'

export interface IMessage extends RowDataPacket {
  id: number
  user_id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_read: boolean
  created_at: Date
  updated_at: Date
  source?: string
  target_path?: string | null
  metadata?: any
}

export type MessageListData = {
  messages: IMessage[]
  unreadCount: number
}

export type UnreadCountData = { unreadCount: number }
