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
  meta?: any
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
  meta?: any
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
  // ---------- 普通 CRUD ----------
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

  // ---------- 用户 / 单位菜单（按角色权限） ----------
  // in-flight 去重 + 结果缓存，避免多次请求
  _userMenusCache: new Map<string, MenuDTO[]>(),
  _userMenusInFlight: new Map<string, Promise<MenuDTO[]>>(),

  async userMenus(userId: number, orgId?: number): Promise<MenuDTO[]> {
    const headers: Record<string, any> = {}
    if (orgId != null) headers['x-org-id'] = String(orgId)
    const key = `${userId}|${orgId ?? ''}`

    if (this._userMenusCache.has(key)) return this._userMenusCache.get(key)!
    if (this._userMenusInFlight.has(key)) return this._userMenusInFlight.get(key)!

    const p = api
      .get(`${BASE}/users/${userId}/menus`, { headers })
      .then(r => {
        const data = pickData<MenuDTO[]>(r) || []
        this._userMenusCache.set(key, data)
        return data
      })
      .finally(() => {
        this._userMenusInFlight.delete(key)
      })

    this._userMenusInFlight.set(key, p)
    return p
  },

  clearUserMenusCache(userId?: number, orgId?: number) {
    if (userId === undefined) {
      this._userMenusCache.clear()
      this._userMenusInFlight.clear()
      return
    }
    const key = `${userId}|${orgId ?? ''}`
    this._userMenusCache.delete(key)
    this._userMenusInFlight.delete(key)
  },

  // ---------- 功能菜单（系统功能路由树） ----------
  _functionsTreeCache: null as null | MenuDTO[],
  _functionsTreeInFlight: null as null | Promise<MenuDTO[]>,
  _functionsTreeLastFailAt: 0,
  _FAIL_COOLDOWN_MS: 1500,

  getRouteTreeCached(): MenuDTO[] | null {
    return this._functionsTreeCache
  },
  clearRouteTreeCache() {
    this._functionsTreeCache = null
    this._functionsTreeInFlight = null
  },

  async routeTree(): Promise<MenuDTO[]> {
    // 兼容老方法（仍走 functions/tree）
    return this.functionsTree()
  },

  async functionsTree(): Promise<MenuDTO[]> {
    if (this._functionsTreeCache) return this._functionsTreeCache
    if (this._functionsTreeInFlight) return this._functionsTreeInFlight

    const now = Date.now()
    if (now - this._functionsTreeLastFailAt < this._FAIL_COOLDOWN_MS) {
      throw new Error('functions-tree cooling down')
    }

    const p = api
      .get('/menus/functions/tree')
      .then(r => {
        const data = pickData<MenuDTO[]>(r)
        this._functionsTreeCache = Array.isArray(data) ? data : []
        return this._functionsTreeCache
      })
      .catch(err => {
        this._functionsTreeLastFailAt = Date.now()
        throw err
      })
      .finally(() => {
        this._functionsTreeInFlight = null
      })

    this._functionsTreeInFlight = p
    return p
  },
}
