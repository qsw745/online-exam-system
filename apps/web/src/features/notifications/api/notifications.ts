import { api } from '@shared/api/http'

type ApiSuccess<T = any> = { success: true; data: T }
const isSuccess = (r: any): r is ApiSuccess => r && r.success === true

function pickArray<T = any>(resp: any, fallback: T[] = []): T[] {
  const d = resp?.data
  if (Array.isArray(resp)) return resp as T[]
  if (Array.isArray(d)) return d as T[]
  if (Array.isArray(d?.items)) return d.items as T[]
  if (Array.isArray(d?.data)) return d.data as T[]
  if (Array.isArray(resp?.items)) return resp.items as T[]
  return fallback
}
function pickTotal(resp: any, fallback = 0) {
  const d = resp?.data ?? resp
  return Number(d?.total ?? d?.pagination?.total ?? fallback) || 0
}
function pickObject<T = any>(resp: any, fallback: T | null = null): T | null {
  const d = resp?.data
  if (d && typeof d === 'object') return d as T
  if (d?.data && typeof d.data === 'object') return d.data as T
  return fallback
}

export type NotificationType = 'info' | 'warning' | 'success' | 'error'
export interface NotificationDTO {
  id: number
  user_id: number
  title: string
  content: string
  type: NotificationType
  is_read: boolean
  created_at: string
  updated_at: string
  user?: { username: string; real_name: string }
}

export const notificationsApi = {
  async adminList(params?: { page?: number; limit?: number }) {
    const resp = await api.get('/notifications/admin/list', { params })
    return { items: pickArray<NotificationDTO>(resp, []), total: pickTotal(resp, 0) }
  },

  async create(payload: { user_id: number; title: string; content: string; type: NotificationType }) {
    const resp = await api.post('/notifications', payload)
    return pickObject<NotificationDTO>(resp)
  },

  async batch(payload: { user_ids: number[]; title: string; content: string; type: NotificationType }) {
    const resp = await api.post('/notifications/batch', payload)
    return isSuccess(resp) ? resp.data : pickObject<{ count: number }>(resp, { count: 0 })
  },

  async update(id: number, payload: { title: string; content: string; type: NotificationType }) {
    const resp = await api.put(`/notifications/admin/${id}`, payload)
    return pickObject<NotificationDTO>(resp)
  },

  async remove(id: number) {
    return api.delete(`/notifications/admin/${id}`)
  },
}
