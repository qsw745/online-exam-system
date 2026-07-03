import { api } from '../core/httpClient'

export type WorkflowStatus = 'draft' | 'published'
export type WorkflowTaskStatus = 'pending' | 'approved' | 'rejected' | 'canceled'

export type WorkflowTemplate = {
  id: number
  name: string
  entity_type: string
  app_code?: string | null
  module_code?: string | null
  form_key?: string | null
  form_name?: string | null
  version: number
  status: WorkflowStatus
  starter_roles?: number[]
  definition?: any
  created_by?: number
  created_at?: string
  updated_at?: string
}

export type WorkflowTask = {
  id: number
  instance_id: number
  node_id: string
  node_name: string
  assignee_id: number
  status: WorkflowTaskStatus
  comment?: string | null
  decided_at?: string | null
  assignee_name?: string
  entity_type?: string
  entity_id?: number
  instance_status?: string
  created_at: string
  payload?: any
}

export type WorkflowInstanceDetail = {
  instance: {
    id: number
    template_id: number
    entity_type: string
    entity_id: number
    status: string
    current_nodes?: string[]
    payload?: any
    created_at?: string
    updated_at?: string
  }
  template: WorkflowTemplate
  tasks: WorkflowTask[]
}

export type WorkflowInstance = {
  id: number
  template_id: number
  template_name?: string
  entity_type: string
  entity_id: number
  status: string
  current_nodes?: string[]
  payload?: any
  created_by?: number
  created_at?: string
  updated_at?: string
}

export type WorkflowList<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

function unwrap(res: any): any {
  if (!res) return res
  if (typeof res === 'object') {
    if ('success' in res) {
      if (res.success) return res.data ?? {}
      throw new Error(res.error || res.message || '请求失败')
    }
    if ('ok' in res) {
      if (res.ok) return res.data ?? res.result ?? res.payload ?? {}
      throw new Error(res?.message || '请求失败')
    }
    if ('data' in res) return (res as any).data
  }
  return res
}

export const workflowsApi = {
  async listTemplates(params?: { entity_type?: string; status?: string; app_code?: string; module_code?: string }): Promise<WorkflowList<WorkflowTemplate>> {
    const res = await api.get('/workflows/templates', { params })
    const payload = unwrap(res)
    const items = Array.isArray(payload) ? payload : payload?.items ?? payload?.list ?? payload?.data ?? []
    return {
      items,
      total: Number(payload?.total ?? items.length ?? 0),
      page: Number(payload?.page ?? 1),
      limit: Number(payload?.limit ?? items.length ?? 20),
    }
  },
  createTemplate: (payload: any) => api.post('/workflows/templates', payload),
  updateTemplate: (id: number, payload: any) => api.put(`/workflows/templates/${id}`, payload),
  publishTemplate: (id: number) => api.post(`/workflows/templates/${id}/publish`),
  async getTemplate(id: number) {
    const res = await api.get(`/workflows/templates/${id}`)
    return unwrap(res)
  },
  async getInstance(id: number): Promise<WorkflowInstanceDetail> {
    const res = await api.get(`/workflows/instances/${id}`)
    return unwrap(res)
  },

  async listMyTasks(params?: { page?: number; limit?: number; status?: string; entity_type?: string }): Promise<WorkflowList<WorkflowTask>> {
    const res = await api.get('/workflows/tasks/mine', { params })
    const payload = unwrap(res)
    const items = payload?.items ?? payload?.list ?? []
    return {
      items,
      total: Number(payload?.total ?? items.length ?? 0),
      page: Number(payload?.page ?? 1),
      limit: Number(payload?.limit ?? items.length ?? 20),
    }
  },
  approveTask: (id: number, payload?: { comment?: string; form_values?: Record<string, any> }) =>
    api.post(`/workflows/tasks/${id}/approve`, payload),
  rejectTask: (id: number, payload?: { comment?: string; form_values?: Record<string, any> }) =>
    api.post(`/workflows/tasks/${id}/reject`, payload),
  transferTask: (id: number, toUserId: number, comment?: string) =>
    api.post(`/workflows/tasks/${id}/transfer`, { to_user_id: toUserId, comment }),
  addSignTask: (id: number, userId: number, comment?: string) =>
    api.post(`/workflows/tasks/${id}/add-sign`, { user_id: userId, comment }),
  withdrawInstance: (id: number) => api.post(`/workflows/instances/${id}/withdraw`),
  async listMyInstances(params?: { page?: number; limit?: number; status?: string }): Promise<WorkflowList<WorkflowInstance>> {
    const res = await api.get('/workflows/instances/mine', { params })
    const payload = unwrap(res)
    const items = payload?.items ?? payload?.list ?? []
    return {
      items,
      total: Number(payload?.total ?? items.length ?? 0),
      page: Number(payload?.page ?? 1),
      limit: Number(payload?.limit ?? items.length ?? 20),
    }
  },
}

export default workflowsApi
