// src/shared/api/endpoints/roles.ts
import { http } from '@/shared/api/http'
import type { ApiResult } from '@/shared/api/core/types'

// —— 基础类型（可按需扩展）——
export interface Role {
  id: number
  name: string
  code: string
  description?: string | null
  is_system?: 0 | 1 | boolean
  is_disabled?: 0 | 1 | boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export interface UserBrief {
  id: number
  username: string
  email?: string
}

export interface RoleOrg {
  id: number
  name?: string
}

export interface CheckCodeResp {
  exists: boolean
  code: string
}

// —— 与后端 routes 完全对齐的调用 ——
// apps/backend/src/modules/roles/routes/role.routes.ts
export const rolesApi = {
  // 角色管理
  // GET /roles  支持分页：?page=&pageSize=&keyword=
  list(params?: { page?: number; pageSize?: number; keyword?: string }) {
    // 当后端分页时：返回 { success, data: { roles, total, page, pageSize } }
    // 当后端不分页时：返回 { success, data: Role[] }
    return http.get<ApiResult<{ roles: Role[]; total: number; page: number; pageSize: number } | Role[]>>('/roles', {
      params,
    })
  },

  // GET /roles/next-sort-order
  getNextSortOrder() {
    return http.get<ApiResult<number>>('/roles/next-sort-order')
  },

  // GET /roles/:id
  get(id: number) {
    return http.get<ApiResult<Role>>(`/roles/${id}`)
  },

  // POST /roles
  create(payload: Pick<Role, 'name'> & Partial<Pick<Role, 'code' | 'description' | 'sort_order' | 'is_disabled'>>) {
    return http.post<ApiResult<Role>>('/roles', payload)
  },

  // PUT /roles/:id
  update(id: number, payload: Partial<Pick<Role, 'name' | 'code' | 'description' | 'sort_order' | 'is_disabled'>>) {
    return http.put<ApiResult<Role>>(`/roles/${id}`, payload)
  },

  // DELETE /roles/:id
  remove(id: number) {
    return http.delete<ApiResult<void>>(`/roles/${id}`)
  },

  // 角色菜单权限
  // GET /roles/:id/menus
  getRoleMenus(id: number) {
    // 实际菜单结构按你的后端返回定义；这里用 any[] 承接
    return http.get<ApiResult<any[]>>(`/roles/${id}/menus`)
  },

  // PUT /roles/:id/menus  Body: { menuIds: number[] }
  setRoleMenus(id: number, menuIds: number[]) {
    return http.put<ApiResult<void>>(`/roles/${id}/menus`, { menuIds })
  },

  // 用户 ⇄ 角色（针对单个用户）
  // GET /roles/users/:userId/roles
  getUserRoles(userId: number) {
    return http.get<ApiResult<Role[]>>(`/roles/users/${userId}/roles`)
  },

  // PUT /roles/users/:userId/roles  Body: { roleIds: number[] }
  setUserRoles(userId: number, roleIds: number[]) {
    return http.put<ApiResult<void>>(`/roles/users/${userId}/roles`, { roleIds })
  },

  // 角色 ⇄ 用户（针对单个角色）
  // GET /roles/:roleId/users
  getRoleUsers(roleId: number) {
    return http.get<ApiResult<UserBrief[]>>(`/roles/${roleId}/users`)
  },

  // POST /roles/:roleId/users  Body: { userIds: number[] }
  addUsersToRole(roleId: number, userIds: number[]) {
    return http.post<ApiResult<{ message?: string }>>(`/roles/${roleId}/users`, { userIds })
  },

  // DELETE /roles/:roleId/users/:userId
  removeUserFromRole(roleId: number, userId: number) {
    return http.delete<ApiResult<void>>(`/roles/${roleId}/users/${userId}`)
  },

  // 角色 ⇄ 机构
  // GET /roles/:id/orgs
  getRoleOrgs(id: number) {
    return http.get<ApiResult<RoleOrg[]>>(`/roles/${id}/orgs`)
  },

  // POST /roles/:id/orgs  Body: { orgIds: number[] }
  addRoleOrgs(id: number, orgIds: number[]) {
    // 后端会返回 { success, message, added? }
    return http.post<ApiResult<{ message?: string; added?: number }>>(`/roles/${id}/orgs`, { orgIds })
  },

  // DELETE /roles/:id/orgs/:orgId
  removeRoleOrg(id: number, orgId: number) {
    return http.delete<ApiResult<void>>(`/roles/${id}/orgs/${orgId}`)
  },

  // 便捷校验/推荐编码
  // GET /roles/check-code?code=xxx
  checkCode(code: string) {
    return http.get<ApiResult<CheckCodeResp>>('/roles/check-code', { params: { code } })
  },

  // GET /roles/suggest-code?name=xxx
  suggestCode(name: string) {
    return http.get<ApiResult<string>>('/roles/suggest-code', { params: { name } })
  },
}
