import { api } from '../core/httpClient'

export const wrongQuestions = {
  recordPractice: (d: { question_id: number; is_correct: boolean; answer: any }) => api.post('/questions/practice', d),
  getPracticedQuestions: () => api.get('/questions/practiced-questions'),
  getWrongQuestions: (params?: { page?: number; limit?: number; mastered?: boolean }) =>
    api.get('/questions/wrong-questions', { params }),
  markAsMastered: (id: number) => api.put(`/questions/wrong-questions/${id}/mastered`),
  removeFromWrongQuestions: (id: number) => api.delete(`/questions/wrong-questions/${id}`),
  getPracticeStats: () => api.get('/questions/practice-stats'),
}
