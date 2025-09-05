import { api } from '../core/httpClient'

export const papers = {
  list: (params?: { difficulty?: string; limit?: number; offset?: number }) => api.get('/papers', { params }),
  getById: (id: string) => api.get(`/papers/${id}`),
  create: (paperData: any) => api.post('/papers', paperData),
  update: (id: string, paperData: any) => api.put(`/papers/${id}`, paperData),
  delete: (id: string) => api.delete(`/papers/${id}`),
  getQuestions: (id: string) => api.get(`/papers/${id}/questions`),
  addQuestion: (paperId: string, data: any) => api.post(`/papers/${paperId}/questions`, data),
  removeQuestion: (paperId: string, qid: string) => api.delete(`/papers/${paperId}/questions/${qid}`),
  updateQuestionOrder: (paperId: string, orderData: any) => api.put(`/papers/${paperId}/questions/order`, orderData),
}
