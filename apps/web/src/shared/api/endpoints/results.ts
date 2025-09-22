import { api } from '../core/httpClient'

export type ResultStatus = 'completed' | 'in_progress' | 'not_started' | 'submitted' | 'graded' | 'expired'

export interface ResultItem {
  id: string | number
  exam_id?: string | number | null
  paper_id: string | number | null
  paper_title: string
  score: number
  total_score: number
  start_time: string | null
  end_time: string | null
  status: ResultStatus
  created_at?: string
  updated_at?: string
  percentage?: number | null
  duration?: number | null
}

export type QuestionResult = {
  id: number
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  content: string
  options: string[] | null
  score: number
  order: number
  user_answer: string | null
  correct_answer: string | null
  is_correct: 0 | 1 | null
}

export type ResultDetail = ResultItem & { questions: QuestionResult[] }

export interface ResultsQuery {
  page?: number
  limit?: number
  status?: ResultStatus | 'all'
  search?: string
  sort?: 'created_at' | 'score' | 'start_time' | 'end_time'
  paper_id?: string | number
  include_student_info?: boolean
}

export interface ResultsList {
  items: ResultItem[]
  total: number
  page: number
  limit: number
}

function unwrap(res: any): any {
  if (!res) return res
  if (typeof res === 'object') {
    if ('ok' in res) {
      if (res.ok) return res.data ?? res.result ?? res.payload ?? {}
      throw new Error(res?.message || '请求失败')
    }
    if ('data' in res) return (res as any).data
  }
  return res
}

function pickList(res: any): ResultsList {
  const root = unwrap(res)
  const payload = root?.data ?? root
  const items = payload?.results ?? payload?.items ?? (Array.isArray(payload) ? payload : []) ?? []
  const p = payload?.pagination ?? payload ?? {}
  const total = Number(p.total ?? payload?.total ?? items.length ?? 0)
  const page = Number(p.page ?? payload?.page ?? 1)
  const limit = Number(p.limit ?? payload?.limit ?? (items.length || 10))
  return { items: items as ResultItem[], total, page, limit }
}

async function getJson(path: string, params?: any) {
  const r: any = await api.get(path, { params })
  return unwrap(r)
}

export const resultsApi = {
  async list(params: ResultsQuery = {}): Promise<ResultsList> {
    try {
      const res = await getJson('/results', params)
      return pickList(res)
    } catch {
      const res2 = await getJson('/exam_results', params)
      return pickList(res2)
    }
  },

  async getById(id: string | number): Promise<ResultItem> {
    const res = await getJson(`/results/${id}`)
    const list = pickList(res)
    if (list.items.length) return list.items[0]
    const payload = unwrap(res)
    return (payload?.data ?? payload) as ResultItem
  },

  /** ✅ 带题目明细 */
  async getDetail(id: string | number): Promise<ResultDetail> {
    const res = await getJson(`/results/${id}`, { include: 'questions' })
    const payload = unwrap(res)
    return (payload?.data ?? payload) as ResultDetail
  },
}

export default resultsApi
