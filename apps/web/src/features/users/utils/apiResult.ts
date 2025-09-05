// features/users/utils/apiResult.ts
export type ApiSuccess<T> = { success: true; data: T; message?: string }
export type ApiFailure = { success: false; error?: string; message?: string }
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export const isSuccess = <T>(r: ApiResult<T>): r is ApiSuccess<T> => !!r && (r as any).success === true
export const getErr = (r: ApiResult<any>, fb = '操作失败') => (r as any)?.message || (r as any)?.error || fb

export const normalizeStatus = (x: any): 'active' | 'disabled' =>
  typeof x.status === 'string'
    ? x.status === 'disabled'
      ? 'disabled'
      : 'active'
    : typeof x.is_active !== 'undefined'
    ? Number(x.is_active) === 1
      ? 'active'
      : 'disabled'
    : 'active'

export const pickDisplayRole = (codes?: string[]) => {
  const arr = (codes || []).map(c => String(c).toLowerCase())
  if (arr.includes('admin')) return 'admin'
  if (arr.includes('teacher')) return 'teacher'
  return 'student'
}
