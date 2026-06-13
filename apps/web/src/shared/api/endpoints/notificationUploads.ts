import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

type CheckResp = { exists: boolean; attachment?: any; uploadedChunks?: number[] }

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const resp = await p
  if (isSuccess<T>(resp)) return resp.data
  throw new Error(getErr(resp, '请求失败'))
}

export const notificationUploadsApi = {
  check: (payload: { hash: string }) => unwrap<CheckResp>(api.post('/notifications/uploads/check', payload)),
  uploadChunk: (form: FormData) => unwrap(api.post('/notifications/uploads/chunk', form, { headers: { 'Content-Type': 'multipart/form-data' } })),
  merge: (payload: { hash: string; filename: string; totalChunks: number; size: number; mime_type?: string }) =>
    unwrap(api.post('/notifications/uploads/merge', payload)),
}
