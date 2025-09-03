export type ApiSuccess<T = any> = {
  success: true
  data: T
  total?: number
  page?: number
  limit?: number
}
export type ApiFailure = { success: false; error: string; code?: string | number }
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
