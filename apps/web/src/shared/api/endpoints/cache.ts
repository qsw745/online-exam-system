import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

type CacheStats = {
  connected: boolean
  version?: string
  uptime?: string
  uptimeSeconds?: number
  uptimeHuman?: string
  memoryUsed?: string
  keys?: number | string
  keysTotal?: number
  keysHuman?: string
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const cacheApi = {
  stats: () => unwrap<CacheStats>(api.get('/cache/stats')),
  flush: () => unwrap(api.post('/cache/flush')),
}
