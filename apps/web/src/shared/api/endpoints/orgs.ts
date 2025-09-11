// src/shared/api/endpoints/orgs.ts
import { api } from '@/shared/api/http'

export interface OrgNode {
  id: number
  name: string
  code?: string | null
  leader?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  description?: string | null
  is_enabled?: boolean // 由后端 is_active / is_enabled 推导
  is_active?: number | null // 原样保留做兼容
  sort_order?: number | null
  parent_id?: number | null
  children?: OrgNode[]
}

type RawOrg = Partial<OrgNode> & {
  is_active?: number | boolean | null
  is_enabled?: number | boolean | null
  children?: RawOrg[] | null
}

/** 兼容 axios 响应和直返对象的取值工具 */
function pick<T = any>(resp: any): T {
  // axios: { data: { success, data } }
  if (resp && typeof resp === 'object') {
    const d = (resp as any).data
    if (d && typeof d === 'object') {
      if ('data' in d) return (d as any).data as T
      return d as T
    }
  }
  // 直接就是数据
  return resp as T
}

/** 规范化单个节点 */
function normalize(raw: RawOrg): OrgNode {
  const enabledFromActive = raw.is_active == null ? undefined : Number(raw.is_active) === 1 || raw.is_active === true
  const enabledFromEnabled =
    raw.is_enabled == null ? undefined : Number(raw.is_enabled) === 1 || raw.is_enabled === true
  const is_enabled = enabledFromEnabled ?? enabledFromActive

  return {
    id: Number(raw.id!),
    name: String(raw.name ?? ''),
    code: raw.code ?? null,
    leader: raw.leader ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
    address: raw.address ?? null,
    description: raw.description ?? null,
    is_enabled,
    is_active: raw.is_active == null ? (is_enabled == null ? null : is_enabled ? 1 : 0) : Number(raw.is_active),
    sort_order: raw.sort_order ?? null,
    parent_id: raw.parent_id ?? null,
    children: Array.isArray(raw.children) ? raw.children.map(normalize) : [],
  }
}

export const orgsApi = {
  /** 树 */
  async tree(): Promise<OrgNode[]> {
    const resp = await api.get('/orgs/tree')
    const data = pick<any>(resp) // 可能是 {success, data:[...]} 或直接 [...]
    const list: RawOrg[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
    return list.map(normalize)
  },

  /** 详情 */
  async get(id: number): Promise<OrgNode> {
    const resp = await api.get(`/orgs/${id}`)
    const data = pick<any>(resp) // 可能是 {success, data:{...}} 或直接 {...}
    const raw: RawOrg = data && data.data ? data.data : data
    return normalize(raw)
  },

  create: (payload: Partial<OrgNode>) => api.post('/orgs', payload),
  update: (id: number, payload: Partial<OrgNode>) => api.put(`/orgs/${id}`, payload),
  remove: (id: number) => api.delete(`/orgs/${id}`),

  addUser: (orgId: number, userId: number) => api.post(`/orgs/${orgId}/users`, { userId }),
  removeUser: (orgId: number, userId: number) => api.delete(`/orgs/${orgId}/users/${userId}`),
}
