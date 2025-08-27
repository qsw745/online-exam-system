import { api } from '../api'

export const orgs = {
  getTree: async (include_disabled = false) => api.get('/orgs/tree', { params: { include_disabled } }),

  // 获取机构下用户（分页/搜索/角色）。后端建议支持 ?include_children=1
  listUsers: async (orgId: number, params: { page?: number; limit?: number; search?: string; role?: string }) =>
    api.get(`/orgs/${orgId}/users`, { params }),

  // 批量把用户加入机构
  addUsers: async (orgId: number, userIds: number[]) => api.post(`/orgs/${orgId}/users`, { user_ids: userIds }),

  // 从机构移除某用户
  removeUser: async (orgId: number, userId: number) => api.delete(`/orgs/${orgId}/users/${userId}`),
}
