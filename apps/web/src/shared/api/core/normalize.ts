// 前端 normalize：兼容新信封(success/code/status/message/trace) 与旧格式
import type { ApiResult, ApiSuccess } from './types'
import { USER_ROLE_KEY } from './storage'

export async function normalize<T = any>(promise: Promise<any>): Promise<ApiResult<T>> {
  try {
    const response: any = await promise
    const body = response?.data ?? response

    // 统一信封：有 success 字段
    if (typeof body?.success !== 'undefined') {
      if (body.success !== true) {
        // 失败：优先 message，其次 error.details/docUrl 可自行拼到 UI
        const msg = body.message || body.error || '请求失败'
        return { success: false, error: String(msg) }
      }

      // 成功
      const payload = body
      const picked = payload.data ?? payload.result ?? payload.list ?? payload.items ?? payload

      const result: ApiSuccess<T> = { success: true, data: (picked ?? {}) as T }

      // 附带分页
      if (payload.total !== undefined) result.total = payload.total
      if (payload.page !== undefined) result.page = payload.page
      if (payload.limit !== undefined) result.limit = payload.limit

      // /users/me 角色兜底
      const url = response.config?.url || ''
      if (url.includes('/users/me') && result.data && typeof result.data === 'object') {
        const role = localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY)
        if (role && !(result.data as any).role) (result.data as any).role = role
      }

      return result
    }

    // 非统一信封：按 data 返回
    return { success: true, data: (body ?? {}) as T }
  } catch (err: any) {
    const e = err as any
    // 有响应：取后端 message/error
    if (e?.response) {
      const b = e.response.data || {}
      const msg = b.message || b.error || '请求失败'
      return { success: false, error: String(msg) }
    }
    if (e?.request) return { success: false, error: '服务器无响应，请检查网络连接' }
    return { success: false, error: '请求配置错误，请稍后重试' }
  }
}
