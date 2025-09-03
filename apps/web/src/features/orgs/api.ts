// src/lib/org/api.ts
import { api } from '../api'

export interface OrgNode {
  id: number
  name: string
  code?: string | null
  parent_id?: number | null
  leader?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  description?: string | null
  is_enabled?: boolean
  sort_order?: number // 👈 新增  // 👈 新增

  children?: OrgNode[]
}

// 统一组织机构接口
export const OrgAPI = {
  /** 获取组织树 */
  async tree() {
    // GET /api/orgs/tree -> { success, data: OrgNode[] }
    return api.get('/orgs/tree') as Promise<{ success: true; data: OrgNode[] }>
  },

  /** 获取组织详情 */
  async get(id: number) {
    return api.get(`/orgs/${id}`) as Promise<{ success: true; data: OrgNode }>
  },

  /** 创建组织 */
  async create(payload: Partial<OrgNode>) {
    // 期望后端返回 { success, data: { id: number } }
    return api.post('/orgs', payload) as Promise<{ success: true; data: { id: number } }>
  },

  /** 更新组织 */
  async update(id: number, payload: Partial<OrgNode>) {
    return api.put(`/orgs/${id}`, payload) as Promise<{ success: true; data: any }>
  },

  /** 删除组织 */
  async remove(id: number) {
    return api.delete(`/orgs/${id}`) as Promise<{ success: true; data: any }>
  },

  /** 可选：移动组织（若你后端有这个接口） */
  async move(id: number, parentId: number | null) {
    return api.put(`/orgs/${id}/move`, { parent_id: parentId }) as Promise<{ success: true; data: any }>
  },

  /** 可选：批量排序（若你后端有这个接口） */
  async sort(updates: Array<{ id: number; parent_id?: number | null; sort_order?: number }>) {
    return api.put(`/orgs/sort`, { updates }) as Promise<{ success: true; data: any }>
  },
}
