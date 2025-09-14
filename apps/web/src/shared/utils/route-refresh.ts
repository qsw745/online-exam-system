export const ROUTE_REFRESH_EVENT = 'app:route-refresh'
export const REFRESH_COOLDOWN_MS = 3000 // 3 秒冷却

const cooldown = new Map<string, number>()

/** 触发当前路径的“同路由刷新”，带全局冷却 */
export function refreshRoute(path: string, ttlMs: number = REFRESH_COOLDOWN_MS): boolean {
  const now = Date.now()
  const last = cooldown.get(path) ?? 0
  if (now - last < ttlMs) return false
  cooldown.set(path, now)
  window.dispatchEvent(new CustomEvent(ROUTE_REFRESH_EVENT, { detail: { path, at: now } }))
  return true
}
