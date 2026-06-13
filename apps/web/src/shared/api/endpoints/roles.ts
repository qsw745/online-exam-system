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
  org_id?: number | null
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

// ⭐ 新增：服务“全部菜单 + 该角色选择状态”
export interface RoleMenusAllResp {
  menus: Array<{ id: number; title: string; name?: string; parent_id?: number | null }>
  selected: number[] // 被该角色选中的菜单 id 列表
  // （可选）兼容：也返回每个菜单的选中态
  // checkedMap?: Record<number, boolean>
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

  // —— 机构内角色（保留） —— //
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

  // —— 角色菜单（旧：分两次；仍保留兼容） —— //
  getRoleMenus(id: number) {
    return api.get<ApiResult<any[]>>(`/roles/${id}/menus`)
  },
  setRoleMenus(id: number, menuIds: number[]) {
    return api.put<ApiResult<void>>(`/roles/${id}/menus`, { menuIds })
  },
  getRoleEffectiveMenus(roleId: number, orgId?: number) {
    return api.get<ApiResult<{ menus: EffectiveMenuItem[]; orgId?: number }>>(`/roles/${roleId}/menus/effective`, {
      params: orgId ? { orgId } : undefined,
    })
  },

  // ⭐ 新增：一次拿到“全部菜单 + 当前角色选中状态”
  getRoleMenusAll(roleId: number) {
    return api.get<ApiResult<RoleMenusAllResp>>(`/roles/${roleId}/menus/all`)
  },

  // 用户 ⇄ 角色
  getUserRoles(userId: number) {
    return api.get<ApiResult<Role[]>>(`/roles/users/${userId}/roles`)
  },
  getRolesForUserAssign(userId: number, orgId?: number) {
    return api.get<ApiResult<{ roles: Role[]; selected: number[] }>>(`/roles/users/${userId}/roles-form`, {
      params: orgId ? { orgId } : undefined,
    })
  },
  setUserRoles(userId: number, roleIds: number[], orgId?: number) {
    return api.put<ApiResult<void>>(`/roles/users/${userId}/roles`, { roleIds, orgId }, { params: orgId ? { orgId } : undefined })
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

  // 角色 ⇄ 机构
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

  // ✅ 按机构批量加人（保留）
  addUsersToRoleByOrg(roleId: number, orgId: number, opts?: { include_children?: boolean }) {
    return api.post<ApiResult<{ added: number }>>(`/roles/${roleId}/users/by-org`, {
      orgId,
      include_children: !!opts?.include_children,
    })
  },
}
