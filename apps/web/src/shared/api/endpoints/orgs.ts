// src/shared/api/endpoints/orgs.ts
import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

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
  is_active?: 0 | 1 | boolean
  sort_order?: number
  parent_id?: number | null
  children?: OrgNode[]
}

/** 兼容两种情况：
 * 1) api 已拦截返回 ApiResult：{ success, data, ... }
 * 2) 直接返回 AxiosResponse：{ data: ApiResult, status, ... }
 */
function bodyOf<T = any>(r: any): ApiResult<T> {
  if (r && typeof r === 'object') {
    if ('success' in r) return r as ApiResult<T> // 已是 ApiResult
    const d = (r as any).data
    if (d && typeof d === 'object' && 'success' in d) return d as ApiResult<T> // AxiosResponse.data
  }
  return r as ApiResult<T>
}

/** 解包成功结果；失败则抛错（带后端 message/error） */
function okOrThrow<T>(r: any, fallback: string): T {
  const b = bodyOf<T>(r)
  if (isSuccess(b)) return b.data as unknown as T
  throw new Error(getErr(b, fallback))
}

export const orgsApi = {
  async tree(): Promise<OrgNode[]> {
    const r = await api.get('/orgs/tree')
    return okOrThrow<OrgNode[]>(r, '获取机构树失败')
  },

  async get(id: number): Promise<OrgNode> {
    const r = await api.get(`/orgs/${id}`)
    return okOrThrow<OrgNode>(r, '获取机构详情失败')
  },

  async create(payload: Partial<OrgNode>): Promise<{ id: number }> {
    const r = await api.post('/orgs', payload)
    return okOrThrow<{ id: number }>(r, '创建组织失败')
  },

  async update(id: number, payload: Partial<OrgNode>): Promise<OrgNode> {
    const r = await api.put(`/orgs/${id}`, payload)
    return okOrThrow<OrgNode>(r, '更新组织失败')
  },

  async remove(id: number): Promise<{ message: string }> {
    const r = await api.delete(`/orgs/${id}`)
    return okOrThrow<{ message: string }>(r, '删除组织失败')
  },

  // —— 组织与用户绑定/移除（保留） —— //
  addUser: (orgId: number, userId: number) => api.post(`/orgs/${orgId}/users`, { userId }),
  removeUser: (orgId: number, userId: number) => api.delete(`/orgs/${orgId}/users/${userId}`),
}
