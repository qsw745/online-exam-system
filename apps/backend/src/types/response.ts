/* eslint-disable @typescript-eslint/no-explicit-any */

// —— 标准成功/失败信封 —— //
export type ApiSuccess<T = any> = {
  success: true
  code: string                 // 稳定业务码，如 'OK'
  status: number               // 回显 HTTP 状态码
  subcode?: number             // 可选数字子码
  message?: string             // 给用户看的提示
  data: T                      // 负载
  meta?: Record<string, any>   // 分页/额外元信息
  trace: {                     // 排障信息
    requestId: string
    timestamp: string
    durationMs?: number
  }
  links?: Record<string, string> // 可选的下一步/帮助链接
}

export type ApiError = {
  success: false
  code: string                 // 稳定业务码，如 'AUTH_BAD_CREDENTIALS'
  status: number               // HTTP 状态码
  subcode?: number             // 可选数字子码
  message: string              // 错误提示
  error?: {
    details?: any
    retryable?: boolean
    docUrl?: string
  }
  meta?: Record<string, any>
  trace: {
    requestId: string
    timestamp: string
    durationMs?: number
  }
  links?: Record<string, string>
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError

// —— 业务码（字符串）建议统一集中维护 —— //
export const CODES = {
  OK: 'OK',
  CREATED: 'CREATED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_BAD_CREDENTIALS: 'AUTH_BAD_CREDENTIALS',
  AUTH_NEED_CAPTCHA: 'AUTH_NEED_CAPTCHA',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// —— 可选数字子码 —— //
export const SUBCODES = {
  OK: 0,
  CREATED: 1,
  VALIDATION_ERROR: 1000,
  AUTH_UNAUTHORIZED: 1004,
  AUTH_FORBIDDEN: 1003,
  AUTH_BAD_CREDENTIALS: 1001,
  AUTH_NEED_CAPTCHA: 1002,
  RATE_LIMITED: 1005,
  INTERNAL_ERROR: 1999,
} as const
