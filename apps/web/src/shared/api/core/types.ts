// 标准化返回类型与守卫
export type ApiSuccess<T = any> = {
  success: true
  data: T
  total?: number
  page?: number
  limit?: number
}
export type ApiFailure = { success: false; error: string }
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure

export const isSuccess = <T>(r: ApiResult<T>): r is ApiSuccess<T> => (r as any)?.success === true
