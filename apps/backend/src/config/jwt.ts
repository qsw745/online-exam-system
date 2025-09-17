/* eslint-disable @/typescript-eslint/no-explicit-any */
declare const process: any

// ---- 通用 duration 解析：支持 "60", 60(秒), "90s", "15m", "2h", "7d" ----
function parseDurationToMs(v: string | number | undefined, fallbackMs: number): number {
  if (v == null) return fallbackMs
  if (typeof v === 'number' && Number.isFinite(v)) {
    // 兼容旧：纯数字按“秒”处理
    return Math.max(0, v) * 1000
  }
  const s = String(v).trim().toLowerCase()
  const m = s.match(/^(\d+)\s*(ms|s|m|h|d)?$/)
  if (!m) return fallbackMs
  const n = Number(m[1])
  const unit = m[2] || 's' // 默认“秒”
  const scale: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return n * (scale[unit] ?? 1000)
}
export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is not set')
    return 'dev-secret'
  }
  return s
}
export function getRefreshJwtSecret(): string {
  const s = process.env.REFRESH_JWT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('REFRESH_JWT_SECRET is not set')
    return 'dev-refresh-secret'
  }
  return s
}

// ============ 统一导出（秒/毫秒）===========
const ACCESS_RAW = process.env.ACCESS_JWT_EXPIRES_IN ?? '15m'
const REFRESH_RAW = process.env.REFRESH_JWT_EXPIRES_IN ?? '7d'

// 毫秒
export const ACCESS_JWT_EXPIRES_MS = parseDurationToMs(ACCESS_RAW, 15 * 60_000)
export const REFRESH_JWT_EXPIRES_MS = parseDurationToMs(REFRESH_RAW, 7 * 24 * 60 * 60_000)

// 供 jsonwebtoken 的 expiresIn（字符串或数字都可；我们统一传“秒数”更直观）
export const ACCESS_JWT_EXPIRES_SEC = Math.floor(ACCESS_JWT_EXPIRES_MS / 1000)
export const REFRESH_JWT_EXPIRES_SEC = Math.floor(REFRESH_JWT_EXPIRES_MS / 1000)

// 兼容旧代码里使用的字符串/数字
export const ACCESS_JWT_EXPIRES_IN  = Math.floor(ACCESS_JWT_EXPIRES_MS / 1000);
export const REFRESH_JWT_EXPIRES_IN = Math.floor(REFRESH_JWT_EXPIRES_MS / 1000);

// 可配置短 token 容忍（默认 0s，不再“多活 30s”）
const CLOCK_RAW = process.env.ACCESS_JWT_CLOCK_TOLERANCE ?? '0s'
export const ACCESS_JWT_CLOCK_TOLERANCE_SEC = Math.floor(parseDurationToMs(CLOCK_RAW, 0) / 1000)

