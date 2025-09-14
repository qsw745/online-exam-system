import { api, isSuccess } from '../http'

/** 统一对外类型（最小可用） */
export interface Discussion {
  id: number
  title?: string
  content?: string
  category_id?: number
  category_name?: string
  category_color?: string
  question_id?: number
  question_title?: string
  author_name?: string
  author_avatar?: string
  is_pinned?: boolean
  is_liked?: boolean
  likes_count?: number
  replies_count?: number
  views_count?: number
  created_at?: string
  updated_at?: string
  [k: string]: any
}
export interface DiscussionCategory {
  id: number
  name?: string
  slug?: string
  color?: string
  [k: string]: any
}
export interface Reply {
  id: number
  discussion_id?: number
  content?: string
  author_name?: string
  author_avatar?: string
  is_liked?: boolean
  likes_count?: number
  created_at?: string
  updated_at?: string
  [k: string]: any
}

export type SortBy = 'latest' | 'hottest' | 'most_replied'

/** ---- 解析助手（容错） ---- */
function pick<T = any>(v: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const val = k.split('.').reduce<any>((acc, key) => (acc ? acc[key] : undefined), v)
    if (val !== undefined && val !== null) return val as T
  }
  return undefined
}
function toArray<T = any>(payload: any, fallback: T[] = []): T[] {
  const d = payload?.data ?? payload
  const raw = Array.isArray(d)
    ? d
    : d?.discussions ?? // ⭐ 关键兼容点
      d?.items ??
      d?.list ??
      d?.rows ??
      d?.data ??
      []
  return Array.isArray(raw) ? (raw as T[]) : fallback
}
function toObject<T = any>(payload: any, fallback: T | null = null): T | null {
  const d = payload?.data ?? payload
  return d && typeof d === 'object' ? (d as T) : fallback
}

/** 讨论归一化（覆盖后端各种命名） */
function normalizeDiscussion(x: any): Discussion {
  const id = Number(pick(x, 'id', 'discussion_id'))
  return {
    id,
    title: pick(x, 'title') ?? '',
    content: pick(x, 'content') ?? '',
    category_id: pick<number>(x, 'category_id', 'category.id'),
    category_name: pick<string>(x, 'category_name', 'category.name') ?? '',
    category_color: pick<string>(x, 'category_color', 'category.color') ?? '',
    question_id: pick<number>(x, 'question_id', 'question.id'),
    question_title: pick<string>(x, 'question_title', 'question.title') ?? '',
    author_name: pick<string>(x, 'author_name', 'username', 'author.name', 'user.name') ?? '',
    author_avatar: pick<string>(x, 'author_avatar', 'avatar', 'author.avatar', 'user.avatar') ?? '',
    is_pinned: !!(pick(x, 'is_pinned', 'pinned') ?? false),
    is_liked: !!(pick(x, 'is_liked', 'liked') ?? false),
    likes_count: Number(pick(x, 'likes_count', 'like_count', 'likes') ?? 0),
    replies_count: Number(pick(x, 'replies_count', 'reply_count') ?? 0),
    views_count: Number(pick(x, 'views_count', 'view_count', 'views') ?? 0),
    created_at: pick<string>(x, 'created_at', 'create_time'),
    updated_at: pick<string>(x, 'updated_at', 'update_time'),
    ...x,
  }
}

/** 回复归一化 */
function normalizeReply(x: any): Reply {
  return {
    id: Number(pick(x, 'id')),
    discussion_id: Number(pick(x, 'discussion_id')),
    content: pick(x, 'content') ?? '',
    author_name: pick<string>(x, 'author_name', 'username', 'author.name', 'user.name') ?? '',
    author_avatar: pick<string>(x, 'author_avatar', 'avatar', 'author.avatar', 'user.avatar') ?? '',
    is_liked: !!(pick(x, 'is_liked', 'liked') ?? false),
    likes_count: Number(pick(x, 'likes_count', 'like_count', 'likes') ?? 0),
    created_at: pick<string>(x, 'created_at', 'create_time'),
    updated_at: pick<string>(x, 'updated_at', 'update_time'),
    ...x,
  }
}

/** 从 ApiResult<T> 中拿数据（容错） */
function getArrayFromApi<T = any>(res: any, fallback: T[] = []): T[] {
  if (isSuccess<T[]>(res)) {
    const d = toArray<T>(res, fallback)
    return Array.isArray(d) ? d : fallback
  }
  return toArray<T>(res, fallback)
}
function getObjectFromApi<T = any>(res: any, fallback: T | null = null): T | null {
  if (isSuccess<T>(res)) {
    return toObject<T>(res, fallback)
  }
  return toObject<T>(res, fallback)
}

/** ---- API ---- */
export const discussionsApi = {
  /** 列表（兼容 data.discussions） */
  async list(params: { category_id?: string | number; sort?: string; limit?: number }) {
    const res = await api.get('/discussions', { params })
    const arr = getArrayFromApi<any>(res, [])
    return arr.map(normalizeDiscussion).filter(d => !!d.id)
  },

  /** 类目（优先新接口；若后端把 categories 放在 /discussions，也能正常工作） */
  async categories() {
    try {
      const res = await api.get('/discussions/categories/list')
      const arr = getArrayFromApi<any>(res, [])
      if (arr.length) {
        return arr.map((x: any) => ({
          id: Number(pick(x, 'id')),
          name: pick<string>(x, 'name') ?? '',
          slug: pick<string>(x, 'slug') ?? '',
          color: pick<string>(x, 'color') ?? '',
          ...x,
        })) as DiscussionCategory[]
      }
    } catch {
      // fallback 到 /discussions 的聚合返回
    }
    // 兜底：从 /discussions 里读 categories
    try {
      const res2 = await api.get('/discussions', { params: { limit: 1 } })
      const d: any = res2?.data ?? res2
      const cats = d?.data?.categories ?? d?.categories ?? []
      if (Array.isArray(cats)) {
        return cats.map((x: any) => ({
          id: Number(pick(x, 'id')),
          name: pick<string>(x, 'name') ?? '',
          slug: pick<string>(x, 'slug') ?? '',
          color: pick<string>(x, 'color') ?? '',
          ...x,
        })) as DiscussionCategory[]
      }
    } catch {}
    return []
  },

  /** 回复列表 */
  async replies(id: number) {
    const res = await api.get(`/discussions/${id}/replies`)
    const arr = getArrayFromApi<any>(res, [])
    return arr.map(normalizeReply)
  },

  /** 新建讨论 */
  async create(payload: { title: string; category_id: number; question_id?: number; content: string }) {
    const res = await api.post('/discussions', payload)
    const obj = getObjectFromApi<any>(res)
    return obj ? normalizeDiscussion(obj) : null
  },

  /** 回复讨论 */
  async reply(id: number, payload: { content: string }) {
    const res = await api.post(`/discussions/${id}/replies`, payload)
    const obj = getObjectFromApi<any>(res)
    return obj ? normalizeReply(obj) : null
  },

  /** 点赞讨论 */
  async like(id: number) {
    const res = await api.post(`/discussions/${id}/like`)
    const obj = getObjectFromApi<any>(res)
    return obj ? { is_liked: !!obj.is_liked, likes_count: Number(obj.likes_count ?? obj.like_count ?? 0) } : null
  },

  /** 点赞回复 */
  async likeReply(id: number) {
    const res = await api.post(`/discussions/replies/${id}/like`)
    const obj = getObjectFromApi<any>(res)
    return obj ? { is_liked: !!obj.is_liked, likes_count: Number(obj.likes_count ?? obj.like_count ?? 0) } : null
  },

  /** 记录浏览（无需理会返回） */
  async viewed(id: number) {
    if (!id) return
    try {
      await api.post(`/discussions/${id}/view`)
    } catch {}
  },
}
