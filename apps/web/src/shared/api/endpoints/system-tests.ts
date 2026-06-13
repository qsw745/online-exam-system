import { api } from '../core/httpClient'
import type { ApiResult } from '../core/types'

export const systemTestsApi = {
  run: (payload: { modules?: string[]; iterations?: number }) =>
    api.post('/system-tests/run', payload) as Promise<ApiResult<any>>,
  job: (id: string) => api.get(`/system-tests/jobs/${encodeURIComponent(id)}`) as Promise<ApiResult<any>>,
}
