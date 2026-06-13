// apps/backend/src/modules/notifications/domain/notification.types.ts
import type { RowDataPacket } from 'mysql2'

export interface INotification extends RowDataPacket {
  id: number
  user_id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_read: boolean
  created_at: Date
  updated_at: Date
  attachments?: any
  source?: string
  target_path?: string | null
  metadata?: any
}

export type NotificationListData = {
  notifications: INotification[]
  unreadCount: number
}

export type UnreadCountData = { unreadCount: number }
