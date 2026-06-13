import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type Announcement = {
  id: number
  title: string
  content: string
  status: 'draft' | 'published'
  published_at?: string | null
  created_at?: string
  updated_at?: string
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const resp = await p
  if (isSuccess<T>(resp)) return resp.data
  throw new Error(getErr(resp, '请求失败'))
}

export const announcementsApi = {
  list: () => unwrap<{ items: Announcement[] }>(api.get('/announcements')).then(r => r.items || []),
  adminList: () => unwrap<{ items: Announcement[] }>(api.get('/announcements/admin')).then(r => r.items || []),
  create: (payload: { title: string; content: string; status?: 'draft' | 'published' }) =>
    unwrap(api.post('/announcements/admin', payload)),
  update: (id: number, payload: { title?: string; content?: string; status?: 'draft' | 'published' }) =>
    unwrap(api.put(`/announcements/admin/${id}`, payload)),
  publish: (id: number) => unwrap(api.post(`/announcements/admin/${id}/publish`)),
  remove: (id: number) => unwrap(api.delete(`/announcements/admin/${id}`)),
}
