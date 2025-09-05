// utils/apiResult.ts
export type ApiSuccess<T = any> = { success: true; data: T; message?: string }
export type ApiFailure = { success: false; error?: string; message?: string }
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
export const isSuccess = <T>(r: ApiResult<T>): r is ApiSuccess<T> => !!r && (r as any).success === true
export const getErr = (r: ApiResult<any>, fb = '请求失败') =>
  (!isSuccess(r) && ((r as any).error || (r as any).message)) || fb
