import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type SchedulerJob = {
  id: number
  name: string
  cron: string
  handler: string
  status: string
  last_run_at?: string | null
  next_run_at?: string | null
  description?: string | null
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const jobsApi = {
  list: () => unwrap<SchedulerJob[]>(api.get('/jobs')),
  create: (payload: Partial<SchedulerJob>) => unwrap<{ id: number }>(api.post('/jobs', payload)),
  update: (id: number, payload: Partial<SchedulerJob>) => unwrap(api.put(`/jobs/${id}`, payload)),
  remove: (id: number) => unwrap(api.delete(`/jobs/${id}`)),
}
