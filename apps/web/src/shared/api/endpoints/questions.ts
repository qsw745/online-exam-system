import { api } from '../core/httpClient'

export const questions = {
  getAll: (params?: { page?: number; limit?: number; search?: string; type?: string }) =>
    api.get('/questions', { params }),
  list: (params?: { type?: string; difficulty?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/questions', { params }),
  getById: (id: string) => api.get(`/questions/${id}`),
  create: (questionData: any) => api.post('/questions', questionData),
  update: (id: string, questionData: any) => api.put(`/questions/${id}`, questionData),
  delete: (id: string) => api.delete(`/questions/${id}`),
  bulkImport: (data: any[]) => api.post('/questions/bulk-import', { questions: data }),
}
