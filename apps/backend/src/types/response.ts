/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiSuccess<T = any> = {
    success: true
    code: string
    status: number
    subcode?: number
    message?: string
    data: T
    meta?: Record<string, any>
    trace: { requestId: string; timestamp: string; durationMs?: number }
    links?: Record<string, string>
}
export type ApiError = {
    success: false
    code: string
    status: number
    subcode?: number
    message: string
    error?: { details?: any; retryable?: boolean; docUrl?: string }
    meta?: Record<string, any>
    trace: { requestId: string; timestamp: string; durationMs?: number }
    links?: Record<string, string>
}
export type ApiResponse<T = any> = ApiSuccess<T> | ApiError

export const CODES = {
    OK: 'OK',
    CREATED: 'CREATED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
    AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
    AUTH_BAD_CREDENTIALS: 'AUTH_BAD_CREDENTIALS',
    AUTH_NEED_CAPTCHA: 'AUTH_NEED_CAPTCHA',
    AUTH_LOCKED: 'AUTH_LOCKED',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export const SUBCODES = {
    OK: 0,
    CREATED: 1,
    VALIDATION_ERROR: 1000,
    AUTH_UNAUTHORIZED: 1004,
    AUTH_FORBIDDEN: 1003,
    AUTH_BAD_CREDENTIALS: 1001,
    AUTH_NEED_CAPTCHA: 1002,
    RATE_LIMITED: 1005,
    AUTH_LOCKED: 1006,
    INTERNAL_ERROR: 1999,
} as const
