// src/shared/api/http/questions.ts
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
}

export const questionsApi = {
  // 允许把 { signal } 透传进来，便于在 hook 里取消上一次请求
  list: (params?: any, config?: any) => api.get('/questions', { params, ...(config || {}) }) as Promise<ApiResult<any>>,
  getById: (id: string | number) => api.get(`/questions/${id}`) as Promise<ApiResult<any>>,
  create: (payload: Partial<Question>) => api.post('/questions', payload) as Promise<ApiResult<any>>,
  update: (id: string | number, payload: Partial<Question>) =>
    api.put(`/questions/${id}`, payload) as Promise<ApiResult<any>>,
  remove: (id: string | number) => api.delete(`/questions/${id}`) as Promise<ApiResult<any>>,

  /** 批量获取题目详情（一次请求，降压） */
  getByIds: (ids: (string | number)[]) => api.post('/questions/batch', { ids }) as Promise<ApiResult<any[]>>,

  /** 标签聚合 */
  getTags: () => api.get('/questions/tags') as Promise<ApiResult<string[]>>,

  /** 知识点聚合（可选） */
  getKnowledgePoints: () => api.get('/questions/knowledge-points') as Promise<ApiResult<string[]>>,
}

export const questions = questionsApi
export type { Question as QuestionDTO }
