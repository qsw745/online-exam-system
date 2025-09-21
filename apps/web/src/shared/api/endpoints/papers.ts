// src/shared/api/endpoints/papers.ts
import { api } from '@/shared/api/http'

export type PaperDifficulty = 'easy' | 'medium' | 'hard'
export type Paper = {
  id: number | string
  title: string
  description?: string
  difficulty?: PaperDifficulty | string
  total_score?: number
  duration?: number
  created_at?: string
  updated_at?: string
}

export type PaperQuestion = {
  paper_id: number
  question_id: number
  score: number
  order: number
  question_title?: string
  question_type?: string
  question_content?: string
  question_options?: string
  question_answer?: string
}

type ListParams = {
  page?: number
  limit?: number
  search?: string
  difficulty?: PaperDifficulty | 'all'
}
type ListResult = { items: Paper[]; total: number }

// 兼容各种返回包裹
const pickData = <T>(resp: any, fallback: T): T => {
  const d = resp?.data ?? resp
  if (d?.data !== undefined) return d.data as T
  return (d as T) ?? fallback
}

export const papersApi = {
  /** 列表 */
  async list(params: ListParams = {}): Promise<ListResult> {
    const q: any = {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      search: params.search || undefined,
    }
    if (params.difficulty && params.difficulty !== 'all') q.difficulty = params.difficulty

    const res = await api.get('/papers', { params: q })
    const d = pickData<any>(res, {})
    // 后端形态可能是 {papers,total} 或 {items,total}
    const items: Paper[] = Array.isArray(d?.items) ? d.items : Array.isArray(d?.papers) ? d.papers : []
    const total: number = Number(d?.total ?? d?.pagination?.total ?? items.length ?? 0)
    return { items, total }
  },

  /** 详情 */
  async getById(id: string | number): Promise<Paper> {
    const res = await api.get(`/papers/${id}`)
    const d = pickData<any>(res, {})
    return d?.paper ?? d
  },

  /** 更新 */
  async update(id: string | number, body: Partial<Paper>) {
    return api.put(`/papers/${id}`, body)
  },

  /** 删除（提供两种别名，兼容不同调用） */
  async delete(id: string | number) {
    return api.delete(`/papers/${id}`)
  },
  async remove(id: string | number) {
    return api.delete(`/papers/${id}`)
  },

  /** 题目：列表 */
  async getQuestions(id: string | number): Promise<PaperQuestion[]> {
    const res = await api.get(`/papers/${id}/questions`)
    const d = pickData<any>(res, {})
    return Array.isArray(d?.questions) ? d.questions : []
  },

  /** 题目：添加 */
  async addQuestion(paperId: string | number, payload: { questionId: number; score: number; order: number }) {
    return api.post(`/papers/${paperId}/questions`, payload)
  },

  /** 题目：删除 */
  async removeQuestion(paperId: string | number, questionId: number) {
    return api.delete(`/papers/${paperId}/questions/${questionId}`)
  },

  /** 题目：更新顺序 */
  async updateOrder(paperId: string | number, orders: Array<{ questionId: number; order: number }>) {
    return api.put(`/papers/${paperId}/questions/order`, { orders })
  } /** ✅ 题库搜索（分页） */,
  async bankList(params: {
    page?: number
    limit?: number
    search?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    type?: 'single_choice' | 'multiple_choice' | 'true_false'
  }): Promise<{ items: any[]; total: number }> {
    const res = await api.get('/papers/bank', { params })
    const d = pickData<any>(res, {})
    const items = Array.isArray(d?.items) ? d.items : []
    const total = Number(d?.total ?? 0)
    return { items, total }
  } /** ✅ 创建试卷并附上题库题 */,
  async createWithQuestions(body: {
    title: string
    description: string
    duration: number
    difficulty: 'easy' | 'medium' | 'hard'
    total_score: number
    questions: Array<{ question_id: number; score: number; order: number }>
  }) {
    return api.post('/papers/create-with-questions', body)
  } /** ✅ 向试卷添加“手工录入题目”（快照挂载） */,
  async addCustomQuestion(
    paperId: number | string,
    body: {
      question_type: 'single_choice' | 'multiple_choice' | 'true_false' | string
      content: string
      options: string[]
      answer: string // 单/判 'A'；多选 'A,B'
      score: number
      order: number
    }
  ) {
    return api.post(`/papers/${paperId}/questions/custom`, body)
  },
}

export default papersApi
