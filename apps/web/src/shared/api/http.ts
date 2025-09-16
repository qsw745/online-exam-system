// 统一对外导出（避免重复导出 ApiResult）
export { api, http } from './core/httpClient'

// 显式导出类型与工具，避免 “*” 造成重复导出冲突，并供端点直接使用
export type { ApiResult, ApiSuccess, ApiFailure } from './core/types'
export { isSuccess, getErr } from './core/types' // ✅ 补上 getErr

// 业务端点聚合
export * from './endpoints'
