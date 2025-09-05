export type ApiSuccess<T = any> = { success: true; data: T; message?: string }
export type ApiFailure = { success: false; error?: string; message?: string }
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure

export const isSuccess = <T>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true

export const getMsg = (r: any, fallback = '请求失败') =>
  r && typeof r === 'object' ? r.message ?? r.error ?? fallback : fallback
