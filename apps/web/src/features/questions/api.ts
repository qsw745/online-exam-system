// src/features/questions/api.ts
import { api } from '@shared/api/http'

type ListParams = {
  page?: number
  limit?: number
  search?: string
  type?: string
}

export const questionsApi = {
  getAll(params: ListParams) {
    return api.get('/questions', { params })
  },
  getById(id: string) {
    return api.get(`/questions/${id}`)
  },
  create(payload: any) {
    return api.post('/questions', payload)
  },
  update(id: string, payload: any) {
    return api.put(`/questions/${id}`, payload)
  },
  delete(id: string) {
    return api.delete(`/questions/${id}`)
  },
  bulkImport(items: any[]) {
    return api.post('/questions/bulk-import', { items })
  },
}
