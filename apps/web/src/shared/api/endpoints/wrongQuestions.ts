import { api } from '../core/httpClient'
import type { ApiResult } from '../core/types'

export const wrongQuestions = {
  /** 记录一次练习结果 */
  recordPractice(payload: { question_id: number; is_correct: boolean; answer: any }): Promise<ApiResult<any>> {
    return api.post('/wrong-questions/records', payload)
  },
  getPracticedQuestions(): Promise<ApiResult<{ ids: number[] } | number[]>> {
    return api.post('/wrong-questions/practiced')
  },
  getWrongQuestions: (params?: { page?: number; limit?: number; mastered?: boolean }) =>
    api.get('/questions/wrong-questions', { params }),
  markAsMastered: (id: number) => api.put(`/questions/wrong-questions/${id}/mastered`),
  removeFromWrongQuestions: (id: number) => api.delete(`/questions/wrong-questions/${id}`),
  getPracticeStats: () => api.get('/questions/practice-stats'),
}
export type WrongQuestionsApi = typeof wrongQuestions
export default wrongQuestions
