import { api } from '@/shared/api/http'

export type PaperDifficulty = 'easy' | 'medium' | 'hard' | string

export interface Paper {
  id: string
  title: string
  description?: string
  duration: number
  difficulty?: PaperDifficulty
  total_score?: number
}

export interface PapersListResp {
  items: Paper[]
  total: number
  page: number
  limit: number
}

function normalizeListPayload(raw: any, fallbackPage = 1, fallbackLimit = 10): PapersListResp {
  const payload = raw?.data ?? raw ?? {}
  const arr =
    (Array.isArray(payload.items) && payload.items) ||
    (Array.isArray(payload.rows) && payload.rows) ||
    (Array.isArray(payload.papers) && payload.papers) ||
    (Array.isArray(payload) && payload) ||
    []

  return {
    items: arr as Paper[],
    total: Number(payload.total ?? arr.length ?? 0),
    page: Number(payload.page ?? fallbackPage),
    limit: Number(payload.limit ?? fallbackLimit),
  }
}

export const papersApi = {
  /** 列表：统一返回 { items, total, page, limit } */
  async list(params?: {
    page?: number
    limit?: number
    search?: string
    difficulty?: PaperDifficulty | 'all'
  }): Promise<PapersListResp> {
    const page = Number(params?.page ?? 1)
    const limit = Number(params?.limit ?? 10)
    const query = {
      page,
      limit,
      search: params?.search || undefined,
      difficulty: params?.difficulty && params.difficulty !== 'all' ? params.difficulty : undefined,
    }
    const r: any = await api.get('/papers', { params: query })
    return normalizeListPayload(r, page, limit)
  },

  getById: (id: string) => api.get<Paper>(`/papers/${id}`),

  create: (data: Omit<Paper, 'id'> & { question_ids?: string[] }) => api.post<Paper>('/papers', data),

  update: (id: string, data: Partial<Paper>) => api.put<Paper>(`/papers/${id}`, data),

  /** 删除：提供 delete 与 remove 两个别名，兼容调用 */
  delete: (id: string) => api.delete<void>(`/papers/${id}`),
  remove: (id: string) => api.delete<void>(`/papers/${id}`),

  /** 试卷下题目 */
  getQuestions: (id: string) => api.get<{ items: any[] }>(`/papers/${id}/questions`),

  addQuestion: (paperId: string, data: { question_id: string; score?: number }) =>
    api.post<void>(`/papers/${paperId}/questions`, data),

  removeQuestion: (paperId: string, qid: string) => api.delete<void>(`/papers/${paperId}/questions/${qid}`),

  updateQuestionOrder: (paperId: string, orderData: { ids: string[] }) =>
    api.put<void>(`/papers/${paperId}/questions/order`, orderData),

  /** 兼容老接口风格（可选） */
  createWithQuestions: (payload: {
    title: string
    description?: string
    duration: number
    difficulty?: PaperDifficulty
    total_score?: number
    question_ids: string[]
  }) => api.post<Paper>('/papers:createWithQuestions', payload),
}

/** 兼容旧命名 */
export const papers = papersApi
export type { Paper as PaperDTO }
