// features/users/services/users.service.ts
import { users, api } from '@shared/api/http'
import { isSuccess } from '../utils/apiResult'

export const usersService = {
  async getById(id: number) {
    const r = await users.getById(id)
    if (!isSuccess(r)) throw new Error(r.error || '加载用户详情失败')
    return r.data
  },
  async searchAll(keyword: string) {
    const r = await users.getAll({ page: 1, limit: 30, search: keyword } as any)
    if (!isSuccess(r)) return []
    return r.data?.users ?? r.data?.items ?? r.data ?? []
  },
  async update(id: number, values: any) {
    const r = await api.put(`/users/${id}`, values)
    if (!isSuccess(r)) throw new Error(r.error || r.message || '更新失败')
  },
  async delete(id: number) {
    const r = await users.delete(String(id))
    if (!isSuccess(r)) throw new Error(r.error || '删除失败')
  },
  async resetPassword(id: number) {
    const r = await users.resetPassword(String(id))
    if (!isSuccess(r)) throw new Error(r.error || '重置密码失败')
  },
  async updateStatus(id: number, status: 'active' | 'disabled') {
    const r = await users.updateStatus(String(id), status as any)
    if (!isSuccess(r)) throw new Error(r.error || '状态更新失败')
  },
  async linkMultiOrgs(userId: number, orgIds: number[]) {
    const r = await api.post(`/users/${userId}/orgs`, { org_ids: orgIds })
    if (!isSuccess(r)) throw new Error(r.error || '关联失败')
  },
}
