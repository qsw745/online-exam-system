import { api, isSuccess } from '../http'

/** 最小可用类型（避免从 '@/shared/types' 引用不存在的导出） */
export interface Discussion {
  id: number
  title?: string
  content?: string
  category_id?: number
  views_count?: number
  likes_count?: number
  is_liked?: boolean
  created_at?: string
  updated_at?: string
  [k: string]: any
}
export interface DiscussionCategory {
  id: number
  name?: string
  slug?: string
  [k: string]: any
}
export interface Reply {
  id: number
  discussion_id?: number
  content?: string
  created_at?: string
  updated_at?: string
  [k: string]: any
}

/** 从 ApiResult<T> 中拿数据的两个小助手 */
function getArray<T = any>(res: any, fallback: T[] = []): T[] {
  return isSuccess<T[]>(res) && Array.isArray(res.data) ? (res.data as T[]) : fallback
}
function getObject<T = any>(res: any, fallback: T | null = null): T | null {
  return isSuccess<T>(res) && res.data && typeof res.data === 'object' ? (res.data as T) : fallback
}

export const discussionsApi = {
  /** 列表 */
  async list(params: { category_id?: string | number; sort?: string; limit?: number }) {
    const res = await api.get<Discussion[]>('/discussions', { params })
    return getArray<Discussion>(res, [])
  },

  /** 类目 */
  async categories() {
    const res = await api.get<DiscussionCategory[]>('/discussions/categories/list')
    return getArray<DiscussionCategory>(res, [])
  },

  /** 回复列表 */
  async replies(id: number) {
    const res = await api.get<Reply[]>(`/discussions/${id}/replies`)
    return getArray<Reply>(res, [])
  },

  /** 新建讨论 */
  async create(payload: { title: string; category_id: number; question_id?: number; content: string }) {
    const res = await api.post<Discussion>('/discussions', payload)
    return getObject<Discussion>(res)
  },

  /** 回复讨论 */
  async reply(id: number, payload: { content: string }) {
    const res = await api.post<Reply>(`/discussions/${id}/replies`, payload)
    return getObject<Reply>(res)
  },

  /** 点赞讨论 */
  async like(id: number) {
    const res = await api.post<{ is_liked: boolean; likes_count: number }>(`/discussions/${id}/like`)
    return getObject<{ is_liked: boolean; likes_count: number }>(res)
  },

  /** 点赞回复 */
  async likeReply(id: number) {
    const res = await api.post<{ is_liked: boolean; likes_count: number }>(`/discussions/replies/${id}/like`)
    return getObject<{ is_liked: boolean; likes_count: number }>(res)
  },

  /** 记录浏览（无需理会返回） */
  async viewed(id: number) {
    try {
      await api.post(`/discussions/${id}/view`)
    } catch {}
  },
}
