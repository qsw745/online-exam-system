// features/users/services/roles.service.ts
import { api } from '@shared/api/http'
import { isSuccess } from '../utils/apiResult'

export const rolesService = {
  async list() {
    const r = await api.get('/roles')
    if (!isSuccess(r)) throw new Error(r.error || '加载角色失败')
    const p = r.data
    return Array.isArray(p) ? p : p?.roles ?? p?.items ?? p?.list ?? []
  },
  async getUserRoles(userId: number) {
    const r = await api.get(`/roles/users/${userId}/roles`)
    if (!isSuccess(r)) return []
    const d = r.data
    return Array.isArray(d) ? d : d?.roles ?? []
  },
  async setUserRoles(userId: number, roleIds: number[]) {
    const r = await api.put(`/roles/users/${userId}/roles`, { roleIds })
    if (!isSuccess(r)) throw new Error(r.error || '角色设置失败')
  },
}
