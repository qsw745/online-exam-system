// src/shared/api/endpoints/orgs.ts
import { api, isSuccess } from '@shared/api/http'

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
  async tree(): Promise<OrgNode[]> {
    const r = await api.get<{ data: OrgNode[] }>('/orgs/tree')
    if (isSuccess(r)) return (r.data as any)?.data ?? []
    throw new Error((r as any)?.error || (r as any)?.message || '获取机构树失败')
  },
  async get(id: number): Promise<OrgNode> {
    const r = await api.get<{ data: OrgNode }>(`/orgs/${id}`)
    if (isSuccess(r)) return (r.data as any)?.data
    throw new Error((r as any)?.error || (r as any)?.message || '获取机构详情失败')
  },
  create: (payload: Partial<OrgNode>) => api.post('/orgs', payload),
  update: (id: number, payload: Partial<OrgNode>) => api.put(`/orgs/${id}`, payload),
  remove: (id: number) => api.delete(`/orgs/${id}`),
}
