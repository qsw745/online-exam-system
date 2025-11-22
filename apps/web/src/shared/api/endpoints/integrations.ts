import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type Integration = {
  id: number
  name: string
  type: string
  endpoint?: string | null
  enabled: boolean
  description?: string | null
  config?: any
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const integrationsApi = {
  list: (type?: string) => unwrap<Integration[]>(api.get('/integrations', { params: { type } })),
  create: (payload: Partial<Integration>) => unwrap<{ id: number }>(api.post('/integrations', payload)),
  update: (id: number, payload: Partial<Integration>) => unwrap(api.put(`/integrations/${id}`, payload)),
  remove: (id: number) => unwrap(api.delete(`/integrations/${id}`)),
}
