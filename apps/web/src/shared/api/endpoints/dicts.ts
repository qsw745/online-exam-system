import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type DictItem = {
  id: number
  dict_id: number
  label: string
  value: string
  tag?: string
  enabled: boolean
  sort_order: number
}

export type Dictionary = {
  id: number
  code: string
  name: string
  description?: string
  enabled: boolean
  sort_order: number
  items: DictItem[]
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const dictsApi = {
  list: () => unwrap<Dictionary[]>(api.get('/dicts')),
  create: (payload: Partial<Dictionary>) => unwrap<{ id: number }>(api.post('/dicts', payload)),
  update: (id: number, payload: Partial<Dictionary>) => unwrap(api.put(`/dicts/${id}`, payload)),
  remove: (id: number) => unwrap(api.delete(`/dicts/${id}`)),
  createItem: (dictId: number, payload: Partial<DictItem>) =>
    unwrap<{ id: number }>(api.post(`/dicts/${dictId}/items`, payload)),
  updateItem: (dictId: number, itemId: number, payload: Partial<DictItem>) =>
    unwrap(api.put(`/dicts/${dictId}/items/${itemId}`, payload)),
  removeItem: (dictId: number, itemId: number) => unwrap(api.delete(`/dicts/${dictId}/items/${itemId}`)),
}

export type { Dictionary as DictDTO }
