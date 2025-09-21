// src/shared/api/endpoints/tasks.ts
import { api } from '../core/httpClient'

type ListParams = {
  page?: number
  limit?: number
  search?: string
  status?: string
  sort?: string
  /** 可选：按任务类型过滤 */
  type?: 'practice' | 'exam' | string
}

export const tasksApi = {
  list: (params?: ListParams) => api.get('/tasks', { params }),
  getById: (id: string | number) => api.get(`/tasks/${id}`),
  create: (taskData: any) => api.post('/tasks', taskData),
  update: (id: string | number, taskData: any) => api.put(`/tasks/${id}`, taskData),
  delete: (id: string | number) => api.delete(`/tasks/${id}`),
  publish: (id: string | number) => api.post(`/tasks/${id}/publish`),
  unpublish: (id: string | number, reason?: string) => api.post(`/tasks/${id}/unpublish`, { reason }),

  /** ✅ 开始/继续考试：后端已兼容 taskId 或 examId */
  startExam: (id: string | number) => api.get(`/tasks/${id}/exam`),

  /** ✅ 提交答卷（按后端约定走 /tasks/:taskId/submit） */
  submit: (taskId: string | number, payload: { answers: Record<string, string>; time_spent?: number }) =>
    api.post(`/tasks/${taskId}/submit`, payload),
}

export default tasksApi
