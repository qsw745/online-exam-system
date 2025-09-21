import { api } from '../core/httpClient'

export type ResultStatus =
  | 'completed'
  | 'in_progress'
  | 'not_started'
  | 'submitted' // ✅ 后端常见写法
  | 'graded' // ✅ 批改完成
  | 'expired' // ✅ 兜底

export interface ResultItem {
  id: string | number
  paper_id: string | number
  paper_title: string
  score: number
  total_score: number
  start_time: string
  end_time: string
  status: ResultStatus
  created_at?: string
  updated_at?: string
  percentage?: number
}

export interface ResultsQuery {
  page?: number
  limit?: number
  status?: ResultStatus | 'all'
  search?: string
  sort?: 'created_at' | 'score' | 'start_time' | 'end_time'
}

export interface ResultsList {
  items: ResultItem[]
  total: number
  page: number
  limit: number
}

// 兼容 { data:{results,pagination} } / { results,pagination } / 纯数组 等多种返回
function pickList(res: any): ResultsList {
  const root = res?.data ?? res
  const payload = root?.data ?? root

  const items = payload?.results ?? payload?.items ?? (Array.isArray(payload) ? payload : []) ?? []

  const p = payload?.pagination ?? payload ?? {}
  const total = Number(p.total ?? payload?.total ?? items.length ?? 0)
  const page = Number(p.page ?? payload?.page ?? 1)
  const limit = Number(p.limit ?? payload?.limit ?? (items.length || 10))

  return {
    items: items as ResultItem[],
    total,
    page,
    limit,
  }
}

export const resultsApi = {
  /** ✅ 双路径兜底：先 /results，失败再试 /exam_results */
  async list(params: ResultsQuery = {}): Promise<ResultsList> {
    try {
      const res = await api.get('/results', { params })
      return pickList(res)
    } catch {
      const res2 = await api.get('/exam_results', { params })
      return pickList(res2)
    }
  },

  async getById(id: string | number): Promise<ResultItem> {
    try {
      const res = await api.get(`/results/${id}`)
      const list = pickList(res)
      // 若后端返回单体详情，也兼容
      if (!list.items.length && res?.data?.data) return res.data.data
      return (list.items[0] as any) || (res?.data?.data ?? res?.data)
    } catch {
      const res2 = await api.get(`/exam_results/${id}`)
      const list2 = pickList(res2)
      if (!list2.items.length && res2?.data?.data) return res2.data.data
      return (list2.items[0] as any) || (res2?.data?.data ?? res2?.data)
    }
  },
}

export default resultsApi
