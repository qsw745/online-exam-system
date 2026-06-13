// apps/web/src/shared/api/core/types.ts
export type ApiSuccess<T = any> = {
  success: true
  data: T
  total?: number
  page?: number
  limit?: number
}

export type ApiFailure = {
  success: false
  error: string
}

export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure

export const isSuccess = <T = any>(r: ApiResult<T>): r is ApiSuccess<T> =>
  !!r && typeof r === 'object' && (r as any).success === true

/** 统一从 ApiResult 中提取错误信息 */
export function getErr(r: ApiResult | any, fallback = '请求失败'): string {
  if (r && typeof r === 'object') {
    // 常见后端返回兜底
    if ('error' in r && r.error) return String(r.error)
    if ('message' in r && r.message) return String((r as any).message)
    if ('data' in r && (r as any).data && (r as any).data.error) return String((r as any).data.error)
  }
  return fallback
}
