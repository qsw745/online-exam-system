export const ROUTE_REFRESH_EVENT = 'app:route-refresh'
export const REFRESH_COOLDOWN_MS = 3000 // 3 秒冷却

const cooldown = new Map<string, number>()

function normalizePath(p: string) {
  if (!p) return '/'
  let x = p.split('#')[0]!.split('?')[0] || '/'
  if (x.length > 1 && x.endsWith('/')) x = x.replace(/\/+$/, '')
  return x.replace(/\/{2,}/g, '/')
}

/** 触发当前路径的“同路由刷新”，带全局冷却 */
export function refreshRoute(path: string, ttlMs: number = REFRESH_COOLDOWN_MS): boolean {
  const target = normalizePath(path)
  const now = Date.now()
  const last = cooldown.get(target) ?? 0
  if (now - last < ttlMs) return false
  cooldown.set(target, now)
  window.dispatchEvent(new CustomEvent(ROUTE_REFRESH_EVENT, { detail: { path: target, at: now } }))
  return true
}
