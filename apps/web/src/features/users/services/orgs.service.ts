// features/users/services/orgs.service.ts
import { api } from '@shared/api/http'
import { isSuccess, type ApiResult } from '../utils/apiResult'

export const orgsService = {
  async tree() {
    const r: ApiResult<any[]> = await api.get('/orgs/tree') // 你现有是 OrgAPI.tree 也可在此转调
    if (!isSuccess(r)) throw new Error(r.error || r.message || '加载组织树失败')
    return r.data
  },
  async orgUsers(params: {
    orgId: number
    page: number
    limit: number
    search?: string
    role?: string
    include_children?: number
  }) {
    const r: ApiResult<any> = await api.get('/orgusers', { params })
    if (!isSuccess(r)) throw new Error(r.error || r.message || '加载用户失败')
    return r.data
  },
  async bindUsers(orgId: number, userIds: number[]) {
    const r: ApiResult<any> = await api.post(`/orgusers/${orgId}/users`, { user_ids: userIds })
    if (!isSuccess(r)) throw new Error(r.error || r.message || '新增失败')
  },
  async unbind(orgId: number, userId: number) {
    const r: ApiResult<any> = await api.delete(`/orgusers/${orgId}/users/${userId}`)
    if (!isSuccess(r)) throw new Error(r.error || r.message || '移除失败')
  },
}
