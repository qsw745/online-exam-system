import { api } from '../core/httpClient'
import type { ApiResult } from '../core/types'

export const wrongQuestions = {
  /** 普通练习统一写入练习记录；后端仅在答错时加入错题本。 */
  recordPractice(payload: { question_id: number; is_correct: boolean; answer: any }): Promise<ApiResult<any>> {
    return api.post('/questions/practice', payload)
  },
  getPracticedQuestions(wrong_question_id?:number): Promise<ApiResult<{ ids: number[] } | number[]>> {
    if (wrong_question_id === undefined) return api.get('/questions/practiced-questions')
    return api.post('/wrong-questions/practiced', { wrong_question_id })
  },
  getWrongQuestions: (params?: { page?: number; limit?: number; mastered?: boolean }) =>
    api.get('/questions/wrong-questions', { params }),
  markAsMastered: (id: number) => api.put(`/questions/wrong-questions/${id}/mastered`),
  removeFromWrongQuestions: (id: number) => api.delete(`/questions/wrong-questions/${id}`),
  getPracticeStats: () => api.get('/questions/practice-stats'),
}
export type WrongQuestionsApi = typeof wrongQuestions
export default wrongQuestions
