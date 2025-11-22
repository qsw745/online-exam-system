import { api } from '@/shared/api/http'

export type NotificationType = 'system' | 'exam' | 'grade' | 'announcement'
export interface NotificationDTO {
  id: number
  title: string
  content: string
  type: NotificationType
  is_read: boolean
  created_at: string
  attachments?: NotificationAttachment[]
}

export type NotificationAttachment = {
  id: number
  file_name: string
  url: string
  file_size: number
  mime_type?: string
}

const pickArray = <T = unknown>(resp: any, fb: T[] = []): T[] => {
  const d = resp?.data
  if (Array.isArray(d)) return d as T[]
  if (Array.isArray(d?.notifications)) return d.notifications as T[]
  if (Array.isArray(resp)) return resp as T[]
  return fb
}
const pickNumber = (resp: any, keys: string[], fb = 0) => {
  const d = resp?.data ?? resp
  for (const k of keys) {
    const v = d?.[k]
    if (typeof v === 'number') return v
  }
  return fb
}

export const notificationsApi = {
  async list() {
    const resp = await api.get<NotificationDTO[] | { notifications: NotificationDTO[] }>('/notifications')
    const arr = pickArray<NotificationDTO>(resp, [])
    return arr.map(item => {
      let attachments: NotificationAttachment[] = []
      try {
        const raw = (item as any).attachments
        if (Array.isArray(raw)) attachments = raw as NotificationAttachment[]
        else if (typeof raw === 'string' && raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) attachments = parsed
        }
      } catch {
        attachments = []
      }
      return { ...item, attachments }
    })
  },
  async unreadCount() {
    const resp = await api.get<{ count?: number; unreadCount?: number }>('/notifications/unread-count')
    return pickNumber(resp, ['count', 'unreadCount'], 0)
  },
  async markRead(id: number) {
    return api.put(`/notifications/${id}/read`)
  },
  async markAllRead() {
    return api.put('/notifications/read-all')
  },
  async remove(id: number) {
    return api.delete(`/notifications/${id}`)
  },
  async create(payload: { user_id: number; title: string; content: string; type?: string }) {
    return api.post('/notifications', payload)
  },
  async createBatch(payload: { user_ids: number[]; title: string; content: string; type?: string }) {
    return api.post('/notifications/batch', payload)
  },
}
