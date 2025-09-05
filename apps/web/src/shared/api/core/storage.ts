// 访问令牌 / 角色 存取与清理工具

export const STORAGE_FLAG_KEY = 'auth_storage' // 'local' | 'session'
export const ACCESS_TOKEN_KEY = 'token'
export const USER_ROLE_KEY = 'userRole'

function getPreferredStorage(): Storage {
  const pref = localStorage.getItem(STORAGE_FLAG_KEY)
  if (pref === 'local') return localStorage
  if (pref === 'session') return sessionStorage
  if (localStorage.getItem(ACCESS_TOKEN_KEY)) return localStorage
  return sessionStorage
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  const st = getPreferredStorage()
  st.setItem(ACCESS_TOKEN_KEY, token)
  if (st === localStorage) sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  else localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function clearAuthAndRedirect() {
  clearAccessToken()
  localStorage.removeItem(USER_ROLE_KEY)
  sessionStorage.removeItem(USER_ROLE_KEY)
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}
