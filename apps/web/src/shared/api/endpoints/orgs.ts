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

/** 组织下用户列表（后端在 /orgs/:orgId/users 提供分页） */
export type OrgUsersList = {
  items: Array<{
    id: number
    username?: string
    email?: string
    real_name?: string
    phone?: string
    status?: 'active' | 'disabled'
    org_id?: number
    org_name?: string
    created_at?: string
    updated_at?: string
  }>
  total: number
  page: number
  limit: number
}

/** 在 endpoints 层统一把 ApiResult<T> 解包成 T；失败抛出 Error，方便页面直接使用 try/catch 或被 normalize 捕获 */
async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r))
}

export const orgsApi = {
  /** 树：返回纯数组（直接可喂给 Tree） */
  async tree(): Promise<OrgNode[]> {
    // 后端返回形如 { success: true, data: [ {id,name,children:[...]} ] }
    return unwrap(api.get<OrgNode[]>('/orgs/tree'))
  },

  /** 详情：返回纯对象 */
  async get(id: number): Promise<OrgNode> {
    return unwrap(api.get<OrgNode>(`/orgs/${id}`))
  },

  /** 创建：返回 { id } 或后端返回的对象都 OK，这里统一取 data */
  async create(payload: Partial<OrgNode>): Promise<{ id: number } | any> {
    return unwrap(api.post<{ id: number } | any>('/orgs', payload))
  },

  /** 更新：返回最新实体（如果后端只回 message 也能正常解包） */
  async update(id: number, payload: Partial<OrgNode>): Promise<OrgNode | any> {
    return unwrap(api.put<OrgNode | any>(`/orgs/${id}`, payload))
  },

  /** 删除：返回 { message } 或空对象 */
  async remove(id: number): Promise<{ message?: string } | any> {
    return unwrap(api.delete<{ message?: string } | any>(`/orgs/${id}`))
  },

  /** —— 组织与用户关系 —— */

  /** 按机构分页查询用户（包含 include_children / search / role）——返回后端原样分页结构 */
  async listUsers(
    orgId: number,
    params?: { page?: number; limit?: number; search?: string; role?: string; include_children?: boolean }
  ): Promise<OrgUsersList> {
    return unwrap(api.get<OrgUsersList>(`/orgs/${orgId}/users`, { params }))
  },

  /** 批量按用户ID添加到机构 */
  async addUsers(orgId: number, userIds: number[]) {
    return unwrap(api.post<{ added: number }>(`/orgs/${orgId}/users`, { user_ids: userIds }))
  },

  /** 批量按邮箱添加到机构 */
  async addUsersByEmail(orgId: number, emails: string[]) {
    return unwrap(
      api.post<{ added: number; matched: number; not_found: string[] }>(`/orgs/${orgId}/users/by-email`, { emails })
    )
  },

  /** 从机构移除用户 */
  async removeUser(orgId: number, userId: number) {
    return unwrap(api.delete<{ message: string }>(`/orgs/${orgId}/users/${userId}`))
  },

  /** 设置主组织 */
  async setPrimary(orgId: number, userId: number) {
    return unwrap(api.put<{ user_id: number; org_id: number }>(`/orgs/${orgId}/users/${userId}/primary`, {}))
  },

  /** 在机构之间移动用户 */
  async moveUser(fromOrgId: number, toOrgId: number, userId: number) {
    return unwrap(
      api.put<{ user_id: number; from_org_id: number; to_org_id: number }>(
        `/orgs/${fromOrgId}/users/${userId}/move/${toOrgId}`,
        {}
      )
    )
  },
}

export default orgsApi
