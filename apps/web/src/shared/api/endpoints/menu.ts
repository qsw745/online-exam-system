// apps/web/src/shared/api/endpoints/menu.ts
import { api } from '../http'

/**
 * 统一从你们的 ApiResult / ApiFailure / axios 响应里“取数据”的兜底方法
 * - 兼容 axios: { data: ... }
 * - 兼容 ok/value: { ok: true, value: ... }
 * - 兼容 success/data: { success: true, data: ... }
 * - 都不匹配时，返回原对象
 */
function pickData<T = unknown>(res: any): T {
  if (res?.data !== undefined) return res.data as T
  if (res?.ok && res?.value !== undefined) return res.value as T
  if (res?.success && res?.data !== undefined) return res.data as T
  return res as T
}

/** 你的后端菜单 DTO */
export interface MenuDTO {
  id: number
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number | null
  sort_order: number
  is_hidden: boolean
  is_disabled: boolean
  is_system: boolean
  menu_type: 'menu' | 'button' | 'page'
  permission_code?: string
  redirect?: string
  meta?: string
  created_at: string
  updated_at: string
}

export interface MenuCreateInput {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number | null
  sort_order?: number
  is_hidden?: boolean
  is_disabled?: boolean
  menu_type?: 'menu' | 'button' | 'page'
  permission_code?: string
  redirect?: string
  meta?: string
}

export interface MenuUpdateInput extends Partial<MenuCreateInput> {}

type BatchSortItem = { id: number; sort_order: number; parent_id?: number | null }

/** 统一的基础路径（复数：/menus） */
const BASE = '/menus'

export const menuApi = {
  /** 列表 */
  async list(): Promise<MenuDTO[]> {
    const res = await api.get(BASE)
    // 兼容后端返回 { success, data } 或直接返回数组
    return pickData<MenuDTO[]>(res)
  },

  /** 创建 */
  async create(payload: MenuCreateInput): Promise<{ success?: boolean; message?: string } | MenuDTO> {
    const res = await api.post(BASE, payload)
    return pickData(res)
  },

  /** 更新 */
  async update(id: number, payload: MenuUpdateInput): Promise<{ success?: boolean; message?: string } | MenuDTO> {
    const res = await api.put(`${BASE}/${id}`, payload)
    return pickData(res)
  },

  /** 删除 */
  async remove(id: number): Promise<{ success?: boolean; message?: string }> {
    const res = await api.delete(`${BASE}/${id}`)
    return pickData(res)
  },

  /** 批量排序 + 可选修改父子关系 */
  async batchSort(menuUpdates: BatchSortItem[]): Promise<{ success?: boolean; message?: string }> {
    const res = await api.post(`${BASE}/batch-sort`, { menuUpdates })
    return pickData(res)
  },

  /** 某个用户的菜单树/列表（你的后端是 /menus/users/:userId/menus） */
  async userMenus(userId: number): Promise<MenuDTO[]> {
    const res = await api.get(`${BASE}/users/${userId}/menus`)
    return pickData<MenuDTO[]>(res)
  },
}
