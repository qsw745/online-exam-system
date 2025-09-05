import type { AxiosError, AxiosResponse } from 'axios'
import type { ApiResult, ApiSuccess } from './types'
import { USER_ROLE_KEY } from './storage'

export async function normalize<T = any>(promise: Promise<AxiosResponse<any>>): Promise<ApiResult<T>> {
  try {
    const response = await promise

    if (response.data && typeof response.data.success !== 'undefined') {
      if (!response.data.success) {
        return { success: false, error: response.data.message || response.data.error || '请求失败' }
      }
      const payload = response.data
      const picked = payload.data ?? payload.result ?? payload.list ?? payload.items ?? payload
      const result: ApiSuccess<T> = { success: true, data: (picked ?? {}) as T }

      if (payload.total !== undefined) result.total = payload.total
      if (payload.page !== undefined) result.page = payload.page
      if (payload.limit !== undefined) result.limit = payload.limit

      const url = response.config.url || ''
      if (url.includes('/users/me') && result.data && typeof result.data === 'object') {
        const role = localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY)
        if (role && !(result.data as any).role) (result.data as any).role = role
      }
      return result
    }

    return { success: true, data: (response.data ?? {}) as T }
  } catch (err: any) {
    const e = err as AxiosError<any>
    if (e.response) {
      const msg = e.response.data?.message || e.response.data?.error || '请求失败'
      return { success: false, error: msg }
    }
    if (e.request) return { success: false, error: '服务器无响应，请检查网络连接' }
    return { success: false, error: '请求配置错误，请稍后重试' }
  }
}
