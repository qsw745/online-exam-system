// src/shared/api/endpoints/roles.ts
import { http } from '@/shared/api/http'
import type { ApiResult } from '@/shared/api/core/types'

export interface Role {
  id: number
  name: string
  code: string
}
export interface RoleMember {
  userId: number
  roleId: number
}

export const rolesApi = {
  list(params?: { q?: string; page?: number; pageSize?: number }) {
    return http.get<ApiResult<{ items: Role[]; total: number }>>('/roles', { params })
  },
  get(id: number) {
    return http.get<ApiResult<Role>>(`/roles/${id}`)
  },
  create(payload: Pick<Role, 'name' | 'code'>) {
    return http.post<ApiResult<Role>>('/roles', payload)
  },
  update(id: number, payload: Partial<Pick<Role, 'name' | 'code'>>) {
    return http.put<ApiResult<Role>>(`/roles/${id}`, payload)
  },
  remove(id: number) {
    return http.delete<ApiResult<void>>(`/roles/${id}`)
  },
  members(id: number) {
    return http.get<ApiResult<RoleMember[]>>(`/roles/${id}/members`)
  },
  addMember(id: number, userId: number) {
    return http.post<ApiResult<void>>(`/roles/${id}/members`, { userId })
  },
  removeMember(id: number, userId: number) {
    return http.delete<ApiResult<void>>(`/roles/${id}/members/${userId}`)
  },
}
