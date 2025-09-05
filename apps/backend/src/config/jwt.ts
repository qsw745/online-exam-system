// apps/backend/src/config/jwt.ts
export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set')
    }
    return 'dev-secret'
  }
  return s
}

export function getRefreshJwtSecret(): string {
  const s = process.env.REFRESH_JWT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REFRESH_JWT_SECRET is not set')
    }
    return 'dev-refresh-secret'
  }
  return s
}

// 访问令牌（短期）
export const ACCESS_JWT_EXPIRES_IN = (process.env.ACCESS_JWT_EXPIRES_IN ?? '15m') as
  | `${number}${'m' | 'h' | 'd'}`
  | number

// 刷新令牌（长期）
export const REFRESH_JWT_EXPIRES_IN = (process.env.REFRESH_JWT_EXPIRES_IN ?? '7d') as
  | `${number}${'m' | 'h' | 'd'}`
  | number

// 兼容旧代码里使用的 JWT_EXPIRES_IN（保持行为：等同 access）
export const JWT_EXPIRES_IN = ACCESS_JWT_EXPIRES_IN
