// src/shared/api/endpoints/results.ts
import { api } from '../core/httpClient'

export type ResultStatus = 'completed' | 'in_progress' | 'not_started'

export interface ResultItem {
  id: string
  paper_id: string
  paper_title: string
  score: number
  total_score: number
  start_time: string
  end_time: string
  status: ResultStatus
  created_at: string
  updated_at: string
}

export interface ResultsQuery {
  page?: number
  limit?: number
  status?: ResultStatus | 'all'
  search?: string
}

export interface ResultsList {
  items: ResultItem[]
  total: number
  page: number
  limit: number
}

// 兼容 { data:{results,pagination} } / { results,pagination } / 其它常见包裹
function pickList(res: any): ResultsList {
  const d = res?.data ?? {}
  const payload = d.data ?? d

  const items = payload.results ?? payload.items ?? (Array.isArray(payload) ? payload : []) ?? []

  const p = payload.pagination ?? {}
  return {
    items: items as ResultItem[],
    total: Number(p.total ?? payload.total ?? items.length ?? 0),
    page: Number(p.page ?? payload.page ?? 1),
    limit: Number(p.limit ?? payload.limit ?? items.length ?? 12),
  }
}

export const resultsApi = {
  async list(params: ResultsQuery = {}): Promise<ResultsList> {
    const res = await api.get('/exam_results', { params })
    return pickList(res)
  },
}
export default resultsApi
