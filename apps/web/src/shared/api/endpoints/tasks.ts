import { api } from '../core/httpClient'

export const tasksApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: string }) =>
    api.get('/tasks', { params }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (taskData: any) => api.post('/tasks', taskData),
  update: (id: string, taskData: any) => api.put(`/tasks/${id}`, taskData),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  publish: (id: string) => api.post(`/tasks/${id}/publish`),
  unpublish: (id: string, reason?: string) => api.post(`/tasks/${id}/unpublish`, { reason }),
}
