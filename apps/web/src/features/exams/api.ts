// src/features/exams/api.ts
import { api } from '@shared/api/http'

export const exams = {
  getById(id: string) {
    return api.get(`/exams/${id}`)
  },
  submit(id: string, payload: any) {
    return api.post(`/exams/${id}/submit`, payload)
  },
}
