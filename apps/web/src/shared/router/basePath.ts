const rawBasePath = ((import.meta.env.VITE_BASE_PATH as string | undefined) || '/').trim()

export const appBasePath = rawBasePath.replace(/\/+$/, '') || '/'

function normalizeAppPath(path: string): string {
  const clean = (path || '/').trim()
  if (!clean || clean === '/') return '/'
  return `/${clean.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/')
}

export function withAppBasePath(path: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) return path
  const normalized = normalizeAppPath(path)
  if (appBasePath === '/') return normalized
  if (normalized === '/') return `${appBasePath}/`
  return `${appBasePath}${normalized}`.replace(/\/{2,}/g, '/')
}

export function withAppAssetPath(path: string): string {
  return withAppBasePath(path)
}

let lastLoginRedirectAt = 0

export function redirectToLogin() {
  if (typeof window === 'undefined') return
  const target = withAppBasePath('/login')
  const now = Date.now()
  if (window.location.pathname !== target && now - lastLoginRedirectAt > 2000) {
    lastLoginRedirectAt = now
    window.location.assign(target)
  }
}
