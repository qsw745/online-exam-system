// features/wrong-questions/services/wq.service.ts
import { wrongQuestions } from '@shared/api/http'

export type WQFilter = 'all' | 'unmastered' | 'mastered'

export interface WrongQuestion {
  id: number
  user_id: number
  question_id: number
  first_wrong_time: string
  last_practice_time: string
  wrong_count: number
  correct_count: number
  is_mastered: boolean
  notes?: string
  content: string
  question_type: string
  options?: any
  correct_answer?: any
  explanation?: string
  knowledge_points?: string[]
}

export interface PracticeStats {
  totalPractice: number
  correctRate: string
  wrongQuestions: number
  masteredQuestions: number
}

export const wqService = {
  async list(params: { page: number; limit: number; filter: WQFilter }) {
    const mastered = params.filter === 'all' ? undefined : params.filter === 'mastered'
    const res = await wrongQuestions.getWrongQuestions({
      page: params.page,
      limit: params.limit,
      mastered,
    })
    if (!res?.success) throw new Error(res?.error || '加载错题本失败')

    const data = res.data
    const list: WrongQuestion[] = data?.wrongQuestions ?? []
    const pageInfo = data?.pagination ?? {}
    const currentPage = Number(pageInfo.currentPage || params.page || 1)
    const totalPages = Number(pageInfo.totalPages || 1)
    // 如后端不返回总条数，这里用 totalPages * limit 兜底
    const total = Number(pageInfo.total ?? totalPages * params.limit)

    return { list, currentPage, totalPages, total }
  },

  async stats() {
    const res = await wrongQuestions.getPracticeStats()
    if (!res?.success) throw new Error(res?.error || '加载统计数据失败')
    return res.data as PracticeStats
  },

  async markMastered(questionId: number) {
    const res = await wrongQuestions.markAsMastered(questionId)
    if (!res?.success) throw new Error(res?.error || '标记失败')
  },

  async remove(questionId: number) {
    const res = await wrongQuestions.removeFromWrongQuestions(questionId)
    if (!res?.success) throw new Error(res?.error || '移除失败')
  },
}
