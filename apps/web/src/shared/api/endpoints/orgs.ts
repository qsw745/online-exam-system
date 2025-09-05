import { api } from '@shared/api/http'

export interface OrgNode {
  id: number
  name: string
  code?: string | null
  leader?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  description?: string | null
  is_enabled?: boolean
  sort_order?: number
  parent_id?: number | null
  children?: OrgNode[]
}

export const orgs = {
  tree: () => api.get<{ data: OrgNode[] }>('/orgs/tree').then(r => r.data),
  get: (id: number) => api.get<{ data: OrgNode }>(`/orgs/${id}`).then(r => r.data),
  create: (payload: Partial<OrgNode>) => api.post('/orgs', payload),
  update: (id: number, payload: Partial<OrgNode>) => api.put(`/orgs/${id}`, payload),
  remove: (id: number) => api.delete(`/orgs/${id}`),
}
