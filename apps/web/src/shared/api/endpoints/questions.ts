import { api } from '../core/httpClient'
import type { ApiResult } from '../core/types'

export type QuestionType = 'single' | 'multiple' | 'truefalse' | 'short' | 'essay'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Question {
  id: string
  title: string
  type: QuestionType
  difficulty?: Difficulty
  score: number
  /** 其他字段按需补充 */
}

export const questionsApi = {
  list: (params?: { keyword?: string; type?: QuestionType; difficulty?: Difficulty }) =>
    api.get<Question[]>('/questions', { params }),

  getById: (id: string) => api.get<Question>(`/questions/${id}`),

  create: (payload: Partial<Question>) => api.post<Question>('/questions', payload),

  update: (id: string, payload: Partial<Question>) => api.put<Question>(`/questions/${id}`, payload),

  remove: (id: string) => api.delete<void>(`/questions/${id}`),
}

/** 兼容旧命名（若曾用过 questions） */
export const questions = questionsApi
export type { Question as QuestionDTO }
