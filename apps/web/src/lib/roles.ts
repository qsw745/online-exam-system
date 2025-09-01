// apps/web/src/lib/roles.ts
import { api, ApiResult } from './api'

export const roles = {
  // 列表
  list: (params: { page?: number; pageSize?: number; keyword?: string }) => api.get('/roles', { params }),

  // 单项 CRUD
  create: (data: any) => api.post('/roles', data),
  update: (id: number, data: any) => api.put(`/roles/${id}`, data),
  remove: (id: number) => api.delete(`/roles/${id}`),

  // 排序号
  nextSortOrder: () => api.get<number>('/roles/next-sort-order'),

  // 角色-菜单
  listMenus: (roleId: number) => api.get<Array<{ id: number }>>(`/roles/${roleId}/menus`),
  saveMenus: (roleId: number, menuIds: number[]) => api.put(`/roles/${roleId}/menus`, { menuIds }),

  // 角色-用户
  listUsers: (roleId: number) => api.get(`/roles/${roleId}/users`),
  addUsers: (roleId: number, userIds: number[]) => api.post(`/roles/${roleId}/users`, { userIds }),
  removeUser: (roleId: number, userId: number) => api.delete(`/roles/${roleId}/users/${userId}`),

  // 角色-机构
  listOrgs: (roleId: number) => api.get(`/roles/${roleId}/orgs`),
  addOrgs: (roleId: number, orgIds: number[]) => api.post(`/roles/${roleId}/orgs`, { orgIds }),
  removeOrg: (roleId: number, orgId: number) => api.delete(`/roles/${roleId}/orgs/${orgId}`),
}

export type { ApiResult } from './api'
