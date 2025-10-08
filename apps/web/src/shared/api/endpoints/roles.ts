// shared/api/endpoints/roles.ts
import { api } from '@/shared/api/http'
import type { ApiResult } from '@/shared/api/core/types'

// —— 基础类型 —— //
export interface Role {
  id: number
  name: string
  code: string
  description?: string | null
  is_system?: 0 | 1 | boolean
  is_disabled?: 0 | 1 | boolean
  sort_order?: number
  org_id?: number | null // ⭐ 新增：角色所属机构（机构内角色）
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
export interface EffectiveMenuItem {
  id: number
  title: string
  name?: string
  parent_id?: number | null
}

export const rolesApi = {
  // 角色管理（全局）
  list(params?: { page?: number; pageSize?: number; keyword?: string }) {
    return api.get<ApiResult<{ roles: Role[]; total: number; page: number; pageSize: number } | Role[]>>('/roles', {
      params,
    })
  },
  getNextSortOrder() {
    return api.get<ApiResult<number>>('/roles/next-sort-order')
  },
  get(id: number) {
    return api.get<ApiResult<Role>>(`/roles/${id}`)
  },
  create(payload: Pick<Role, 'name'> & Partial<Pick<Role, 'code' | 'description' | 'sort_order' | 'is_disabled'>>) {
    return api.post<ApiResult<Role>>('/roles', payload)
  },
  update(id: number, payload: Partial<Pick<Role, 'name' | 'code' | 'description' | 'sort_order' | 'is_disabled'>>) {
    return api.put<ApiResult<Role>>(`/roles/${id}`, payload)
  },
  remove(id: number) {
    return api.delete<ApiResult<void>>(`/roles/${id}`)
  },

  // ⭐ 按机构的角色管理（本次新增）
  listInOrg(orgId: number, params?: { page?: number; pageSize?: number; keyword?: string }) {
    return api.get<ApiResult<{ roles: Role[]; total: number; page: number; pageSize: number }>>(
      `/orgs/${orgId}/roles`,
      { params }
    )
  },
  createInOrg(
    orgId: number,
    payload: Pick<Role, 'name'> & Partial<Pick<Role, 'code' | 'description' | 'sort_order' | 'is_disabled'>>
  ) {
    return api.post<ApiResult<Role>>(`/orgs/${orgId}/roles`, payload)
  },
  updateInOrg(
    orgId: number,
    id: number,
    payload: Partial<Pick<Role, 'name' | 'code' | 'description' | 'sort_order' | 'is_disabled'>>
  ) {
    return api.put<ApiResult<Role>>(`/orgs/${orgId}/roles/${id}`, payload)
  },
  removeInOrg(orgId: number, id: number) {
    return api.delete<ApiResult<void>>(`/orgs/${orgId}/roles/${id}`)
  },

  // 角色菜单权限（选中项：系统菜单ID）
  getRoleMenus(id: number) {
    return api.get<ApiResult<any[]>>(`/roles/${id}/menus`)
  },
  setRoleMenus(id: number, menuIds: number[]) {
    return api.put<ApiResult<void>>(`/roles/${id}/menus`, { menuIds })
  },

  // ✅ 生效菜单（后端优先依据 role.org_id；也允许显式 ?orgId=）
  getRoleEffectiveMenus(roleId: number, orgId?: number) {
    return api.get<ApiResult<{ menus: EffectiveMenuItem[]; orgId?: number }>>(`/roles/${roleId}/menus/effective`, {
      params: orgId ? { orgId } : undefined,
    })
  },

  // 用户 ⇄ 角色
  getUserRoles(userId: number) {
    return api.get<ApiResult<Role[]>>(`/roles/users/${userId}/roles`)
  },
  setUserRoles(userId: number, roleIds: number[]) {
    return api.put<ApiResult<void>>(`/roles/users/${userId}/roles`, { roleIds })
  },

  // 角色 ⇄ 用户
  getRoleUsers(roleId: number) {
    return api.get<ApiResult<UserBrief[]>>(`/roles/${roleId}/users`)
  },
  addUsersToRole(roleId: number, userIds: number[]) {
    return api.post<ApiResult<{ message?: string }>>(`/roles/${roleId}/users`, { userIds })
  },
  removeUserFromRole(roleId: number, userId: number) {
    return api.delete<ApiResult<void>>(`/roles/${roleId}/users/${userId}`)
  },

  // 角色 ⇄ 机构（依旧保留给“老角色”场景）
  getRoleOrgs(id: number) {
    return api.get<ApiResult<RoleOrg[]>>(`/roles/${id}/orgs`)
  },
  addRoleOrgs(id: number, orgIds: number[]) {
    return api.post<ApiResult<{ message?: string; added?: number }>>(`/roles/${id}/orgs`, { orgIds })
  },
  removeRoleOrg(id: number, orgId: number) {
    return api.delete<ApiResult<void>>(`/roles/${id}/orgs/${orgId}`)
  },

  // 校验/编码
  checkCode(code: string) {
    return api.get<ApiResult<CheckCodeResp>>('/roles/check-code', { params: { code } })
  },
  suggestCode(name: string) {
    return api.get<ApiResult<string>>('/roles/suggest-code', { params: { name } })
  },
  addUsersToRoleByOrg(roleId: number, orgId: number, opts?: { include_children?: boolean }) {
    return api.post<ApiResult<{ added: number }>>(`/roles/${roleId}/users/by-org`, {
      orgId,
      include_children: !!opts?.include_children,
    })
  },
}
