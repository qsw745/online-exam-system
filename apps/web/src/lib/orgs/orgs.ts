// apps/web/src/lib/orgs/orgs.ts
import { api } from '../api'

export const orgs = {
  // 组织树
  getTree: async (include_disabled = false) => api.get('/orgs/tree', { params: { include_disabled } }),

  // 统一：只用组织维度拉用户（支持含子部门）
  listUsers: async (
    orgId: number,
    params: { page?: number; limit?: number; search?: string; role?: string; include_children?: 0 | 1 }
  ) => api.get(`/orgs/${orgId}/users`, { params }),

  // 批量把用户加入机构
  addUsers: async (orgId: number, userIds: number[]) => api.post(`/orgs/${orgId}/users`, { user_ids: userIds }),

  // 从机构移除某用户
  removeUser: async (orgId: number, userId: number) => api.delete(`/orgs/${orgId}/users/${userId}`),

  // 设为主组织
  setPrimary: async (userId: number, orgId: number) => api.put(`/orgs/${orgId}/users/${userId}/primary`, {}),

  // ⭐ 移动用户部门：from → to（移动后不在 from）
  moveUser: async (fromOrgId: number, userId: number, toOrgId: number) =>
    api.put(`/orgs/${fromOrgId}/users/${userId}/move/${toOrgId}`, {}),

  // ⭐ 批量关联多个部门（可选主组织）
  linkUserOrgs: async (userId: number, orgIds: number[], primaryOrgId?: number) =>
    api.post(`/orgs/users/${userId}/orgs`, {
      org_ids: orgIds,
      ...(primaryOrgId ? { primary_org_id: primaryOrgId } : {}),
    }),
}
