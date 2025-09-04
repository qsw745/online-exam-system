export type ApiSuccess<T = any> = { success: true; data: T; total?: number; page?: number; limit?: number }
export type ApiFailure = { success: false; error: string; code?: string }
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
export const ok = <T>(data: T): ApiSuccess<T> => ({ success: true, data })
export const fail = (error: string, code?: string): ApiFailure => ({ success: false, error, code })
