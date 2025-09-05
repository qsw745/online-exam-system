// services/roles.ts
import { api } from '@shared/api/http'
import type { Role } from '../types'

export const roleService = {
  list: (params: { page: number; limit: number; keyword?: string }) => api.get('/roles', { params }),
  create: (payload: Partial<Role>) => api.post('/roles', payload),
  update: (id: number, payload: Partial<Role>) => api.put(`/roles/${id}`, payload),
  remove: (id: number) => api.delete(`/roles/${id}`),

  menus: () => api.get('/menus'),
  roleMenus: (roleId: number) => api.get(`/roles/${roleId}/menus`),
  saveRoleMenus: (roleId: number, menu_ids: number[]) => api.post(`/roles/${roleId}/menus`, { menu_ids }),

  roleUsers: (roleId: number) => api.get(`/roles/${roleId}/users`),
  addUsers: (roleId: number, userIds: number[]) => api.post(`/roles/${roleId}/users`, { userIds }),
  removeUser: (roleId: number, userId: number) => api.delete(`/roles/${roleId}/users/${userId}`),

  users: (params = { page: 1, limit: 1000 }) => api.get('/users', { params }),

  addOrgs: (roleId: number, org_ids: number[]) => api.post(`/roles/${roleId}/orgs`, { org_ids }),
}
