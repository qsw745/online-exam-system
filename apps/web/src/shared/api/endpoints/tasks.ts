// src/shared/api/endpoints/tasks.ts
import { api } from '../core/httpClient'

type ListParams = {
  page?: number
  limit?: number
  search?: string
  status?: string
  sort?: string
  type?: 'practice' | 'exam' | string
}

export const tasksApi = {
  /** 管理列表（老师/管理员用） */
  list: (params?: ListParams) => api.get('/tasks', { params }),

  /** 我的任务（学生用） */
  listMine: (params?: Omit<ListParams, 'sort'>) => api.get('/tasks/mine', { params }),

  getById: (id: string | number) => api.get(`/tasks/${id}`),
  create: (taskData: any) => api.post('/tasks', taskData),
  update: (id: string | number, taskData: any) => api.put(`/tasks/${id}`, taskData),
  delete: (id: string | number) => api.delete(`/tasks/${id}`),
  publish: (id: string | number) => api.post(`/tasks/${id}/publish`),
  unpublish: (id: string | number, reason?: string) => api.post(`/tasks/${id}/unpublish`, { reason }),
  startExam: (id: string | number) => api.get(`/tasks/${id}/exam`),
  submit: (taskId: string | number, payload: { answers: Record<string, string>; time_spent?: number }) =>
    api.post(`/tasks/${taskId}/submit`, payload),
}

export default tasksApi
