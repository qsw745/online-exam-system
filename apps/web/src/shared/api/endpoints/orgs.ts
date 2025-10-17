import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'
import type { UsersListResult, UserDTO } from './users'

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

/** 兼容类型（老代码里可能还引用） */
export type OrgUsersList = {
  items: Array<UserDTO>
  total: number
  page: number
  limit: number
}

/** 统一解包 */
async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r))
}

export const orgsApi = {
  /** 树 */
  async tree(): Promise<OrgNode[]> {
    return unwrap(api.get<OrgNode[]>('/orgs/tree'))
  },

  /** 详情 */
  async get(id: number): Promise<OrgNode> {
    return unwrap(api.get<OrgNode>(`/orgs/${id}`))
  },

  /** 创建 */
  async create(payload: Partial<OrgNode>): Promise<{ id: number } | any> {
    return unwrap(api.post<{ id: number } | any>('/orgs', payload))
  },

  /** 更新 */
  async update(id: number, payload: Partial<OrgNode>): Promise<OrgNode | any> {
    return unwrap(api.put<OrgNode | any>(`/orgs/${id}`, payload))
  },

  /** 删除 */
  async remove(id: number): Promise<{ message?: string } | any> {
    return unwrap(api.delete<{ message?: string } | any>(`/orgs/${id}`))
  },

  /** ---------------- 兼容旧“组织下用户”接口：内部改为调用 /users ---------------- */

  /** 列表：等价于 GET /users?orgId=&include_children= */
  async listUsers(
    orgId: number,
    params?: { page?: number; limit?: number; search?: string; role?: string; include_children?: boolean }
  ): Promise<OrgUsersList> {
    const q = { ...(params || {}), orgId }
    const d = await unwrap<UsersListResult>(api.get<UsersListResult>('/users', { params: q }))
    return {
      items: (d.users || []).map(u => ({ ...u, org_id: u.org_id ?? u.orgId ?? orgId })),
      total: d.total,
      page: d.page,
      limit: d.limit,
    }
  },

  /** 批量按用户ID添加到机构：等价于针对每个用户 PUT /users/:id { org_id: orgId } */
  async addUsers(orgId: number, userIds: number[]) {
    await Promise.all(userIds.map(id => api.put(`/users/${id}`, { org_id: orgId })))
    return { added: userIds.length }
  },

  /** 批量按邮箱添加：后端已无对应接口，这里直接抛错提示（避免 404） */
  async addUsersByEmail(_orgId: number, _emails: string[]) {
    throw new Error('按邮箱批量添加用户的接口已下线，请先创建/查找用户后，再设置其主机构。')
  },

  /** 从机构移除用户：等价于 PUT /users/:id { org_id: null } */
  async removeUser(_orgId: number, userId: number) {
    await api.put(`/users/${userId}`, { org_id: null })
    return { message: 'ok' }
  },

  /** 设置主机构：等价于 PUT /users/:id { org_id } */
  async setPrimary(orgId: number, userId: number) {
    await api.put(`/users/${userId}`, { org_id: orgId })
    return { user_id: userId, org_id: orgId }
  },

  /** 在机构之间移动：等价于 PUT /users/:id { org_id: toOrgId } */
  async moveUser(_fromOrgId: number, toOrgId: number, userId: number) {
    await api.put(`/users/${userId}`, { org_id: toOrgId })
    return { user_id: userId, from_org_id: _fromOrgId, to_org_id: toOrgId }
  },
}

export default orgsApi
