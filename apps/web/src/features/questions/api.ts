// src/features/questions/api.ts
import { api } from '@shared/api/http'

type ListParams = {
  page?: number
  limit?: number
  search?: string
  type?: string
  tags?: string
  difficulty?: string
}

export const questionsApi = {
  getAll(params: ListParams) {
    return api.get('/questions', { params })
  },
  getById(id: string | number) {
    return api.get(`/questions/${id}`)
  },
  create(payload: any) {
    return api.post('/questions', payload)
  },
  update(id: string | number, payload: any) {
    return api.put(`/questions/${id}`, payload)
  },
  delete(id: string | number) {
    return api.delete(`/questions/${id}`)
  },

  /**
   * 支持 upsert：
   * - 会把 upsert 同时放到 body 和 query，后端按任何一种都能读到
   */
  bulkImport(items: any[], opts?: { upsert?: boolean }) {
    const upsert = !!opts?.upsert
    return api.post(
      '/questions/bulk-import',
      { questions: items, upsert },
      { params: upsert ? { upsert: 'true' } : undefined }
    )
  },

  getTags() {
    return api.get('/questions/tags')
  },
}
