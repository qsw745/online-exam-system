import { api } from '../http'

function pickData<T = unknown>(res: any): T {
  if (res?.data !== undefined) return res.data as T
  if (res?.ok && res?.value !== undefined) return res.value as T
  if (res?.success && res?.data !== undefined) return res.data as T
  return res as T
}

/** 与后端一致：menu_type 使用 'menu' | 'button' | 'link' */
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
  menu_type: 'menu' | 'button' | 'link'
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
  menu_type?: 'menu' | 'button' | 'link'
  permission_code?: string
  redirect?: string
  meta?: string
}
export interface MenuUpdateInput extends Partial<MenuCreateInput> {}

type BatchSortItem = { id: number; sort_order: number; parent_id?: number | null }
type ScopeOpts = { scope?: 'system' | 'unit'; unitId?: number }

const BASE = '/menus'
const paramsOf = (o?: ScopeOpts) => ({
  params: {
    ...(o?.scope ? { scope: o.scope } : {}),
    ...(o?.unitId != null ? { unitId: o.unitId } : {}),
  },
})

export const menuApi = {
  async list(opts?: ScopeOpts): Promise<MenuDTO[]> {
    const res = await api.get(BASE, paramsOf(opts))
    return pickData<MenuDTO[]>(res)
  },

  async create(payload: MenuCreateInput, opts?: ScopeOpts) {
    const res = await api.post(BASE, payload, paramsOf(opts))
    return pickData(res)
  },

  async update(id: number, payload: MenuUpdateInput, opts?: ScopeOpts) {
    const res = await api.put(`${BASE}/${id}`, payload, paramsOf(opts))
    return pickData(res)
  },

  async remove(id: number, opts?: ScopeOpts) {
    const res = await api.delete(`${BASE}/${id}`, paramsOf(opts))
    return pickData(res)
  },

  async batchSort(menuUpdates: BatchSortItem[], opts?: ScopeOpts) {
    const res = await api.post(`${BASE}/batch-sort`, { menuUpdates }, paramsOf(opts))
    return pickData(res)
  },

  async userMenus(userId: number): Promise<MenuDTO[]> {
    const res = await api.get(`${BASE}/users/${userId}/menus`)
    return pickData<MenuDTO[]>(res)
  },

  async routeTree(): Promise<MenuDTO[]> {
    const r = await api.get('/menus/route-tree')
    return pickData<MenuDTO[]>(r)
  },
}
