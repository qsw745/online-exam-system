import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type SystemConfig = {
  id: number
  config_key: string
  config_name: string
  config_value?: string | null
  value_type: string
  enabled: boolean
  description?: string | null
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const systemConfigsApi = {
  list: () => unwrap<SystemConfig[]>(api.get('/configs')),
  create: (payload: Partial<SystemConfig>) => unwrap<{ id: number }>(api.post('/configs', payload)),
  update: (id: number, payload: Partial<SystemConfig>) => unwrap(api.put(`/configs/${id}`, payload)),
  remove: (id: number) => unwrap(api.delete(`/configs/${id}`)),
}
