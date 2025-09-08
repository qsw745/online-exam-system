import { api } from '../core/httpClient'
import type { Difficulty } from './questions'

export interface Paper {
  id: string
  title: string
  description?: string
  duration: number
  difficulty?: Difficulty
  total_score?: number
}

export interface CreatePaperWithQuestionsPayload {
  title: string
  description?: string
  duration: number
  difficulty?: Difficulty
  total_score?: number
  question_ids: string[]
}

export const papersApi = {
  list: (params?: { difficulty?: Difficulty; limit?: number; offset?: number }) =>
    api.get<Paper[]>('/papers', { params }),

  getById: (id: string) => api.get<Paper>(`/papers/${id}`),

  create: (paperData: Omit<CreatePaperWithQuestionsPayload, 'question_ids'>) => api.post<Paper>('/papers', paperData),

  update: (id: string, paperData: Partial<Paper>) => api.put<Paper>(`/papers/${id}`, paperData),

  delete: (id: string) => api.delete<void>(`/papers/${id}`),

  /** 试卷下题目 */
  getQuestions: (id: string) => api.get<{ items: any[] }>(`/papers/${id}/questions`),

  addQuestion: (paperId: string, data: { question_id: string; score?: number }) =>
    api.post<void>(`/papers/${paperId}/questions`, data),

  removeQuestion: (paperId: string, qid: string) => api.delete<void>(`/papers/${paperId}/questions/${qid}`),

  updateQuestionOrder: (paperId: string, orderData: { ids: string[] }) =>
    api.put<void>(`/papers/${paperId}/questions/order`, orderData),

  /** ✅ 供 useManualPaper 使用 */
  createWithQuestions: (payload: CreatePaperWithQuestionsPayload) =>
    api.post<Paper>('/papers:createWithQuestions', payload),
}

/** 兼容旧命名（若代码里 import { papers }） */
export const papers = papersApi
export type { Paper as PaperDTO }
