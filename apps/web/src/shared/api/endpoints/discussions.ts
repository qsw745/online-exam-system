import { api, isSuccess } from '../http'
import type { Discussion, DiscussionCategory, Reply } from '../../../features/discussions/types'

function pickArray<T = any>(res: any, fallback: T[] = []): T[] {
  const d = res?.data
  if (Array.isArray(d)) return d as T[]
  if (Array.isArray(d?.data)) return d.data as T[]
  return fallback
}
function pickObject<T = any>(res: any, fallback: T | null = null): T | null {
  const d = res?.data
  if (d && typeof d === 'object') return d as T
  if (d?.data && typeof d.data === 'object') return d.data as T
  return fallback
}

export const discussionsApi = {
  async list(params: { category_id?: string | number; sort?: string; limit?: number }) {
    const res = await api.get('/discussions', { params })
    return isSuccess(res) ? pickArray<Discussion>(res, []) : []
  },
  async categories() {
    const res = await api.get('/discussions/categories/list')
    return isSuccess(res) ? pickArray<DiscussionCategory>(res, []) : []
  },
  async replies(id: number) {
    const res = await api.get(`/discussions/${id}/replies`)
    return isSuccess(res) ? pickArray<Reply>(res, []) : []
  },
  async create(payload: { title: string; category_id: number; question_id?: number; content: string }) {
    const res = await api.post('/discussions', payload)
    return pickObject<Discussion>(res)
  },
  async reply(id: number, payload: { content: string }) {
    const res = await api.post(`/discussions/${id}/replies`, payload)
    return pickObject<Reply>(res)
  },
  async like(id: number) {
    const res = await api.post(`/discussions/${id}/like`)
    return pickObject<{ is_liked: boolean; likes_count: number }>(res)
  },
  async likeReply(id: number) {
    const res = await api.post(`/discussions/replies/${id}/like`)
    return pickObject<{ is_liked: boolean; likes_count: number }>(res)
  },
  async viewed(id: number) {
    try {
      await api.post(`/discussions/${id}/view`)
    } catch {}
  },
}
