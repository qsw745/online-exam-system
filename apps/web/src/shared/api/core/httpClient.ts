// apps/web/src/shared/api/core/httpClient.ts
import axios from 'axios'
import { normalize } from './normalize'
import { getAccessToken, setAccessToken, clearTokenAll, getAuthStorageFlag, type AuthStorageMode } from './storage'

// --- 环境变量容错（不依赖类型声明也能工作） ---
const isDev = typeof import.meta !== 'undefined' && (import.meta as any)?.env && Boolean((import.meta as any).env.DEV)
export const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_URL) || '/api'

// 本地开发走代理 /api，生产用 VITE_API_URL
const baseURL = isDev ? '/api' : API_URL

export const http = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
  withCredentials: true, // 携带 HttpOnly 刷新令牌 Cookie
}) as ReturnType<typeof axios.create>

// ================= 工具：安全跳转登录 =================
let _lastRedirectAt = 0
function redirectToLogin(path = '/login') {
  try {
    const now = Date.now()
    const alreadyOnLogin = typeof window !== 'undefined' && window.location?.pathname === path
    if (!alreadyOnLogin && now - _lastRedirectAt > 2000) {
      _lastRedirectAt = now
      window.location.assign(path)
    }
  } catch {
    // ignore
  }
}
function clearAuthAndRedirect() {
  clearTokenAll()
  redirectToLogin('/login')
}

// ================= 刷新令牌并发控制 =================
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

function pickAccessToken(respData: any): string | null {
  if (!respData) return null
  const d = respData.data ?? respData
  return d?.token ?? d?.access_token ?? d?.accessToken ?? d?.jwt ?? null
}

async function postRefresh(): Promise<string | null> {
  const resp = await http.post('/auth/refresh') // 无请求体
  const token = pickAccessToken(resp?.data)
  if (typeof token === 'string' && token) {
    const mode: AuthStorageMode = getAuthStorageFlag()
    setAccessToken(token, mode)
    return token
  }
  return null
}

async function getRefresh(): Promise<string | null> {
  const resp = await http.get('/auth/refresh')
  const token = pickAccessToken(resp?.data)
  if (typeof token === 'string' && token) {
    const mode: AuthStorageMode = getAuthStorageFlag()
    setAccessToken(token, mode)
    return token
  }
  return null
}

async function doRefreshAccessToken(): Promise<string | null> {
  try {
    return (await postRefresh()) ?? (await getRefresh())
  } catch {
    return null
  }
}

function ensureRefresh(): Promise<string | null> {
  if (!isRefreshing) {
    isRefreshing = true
    refreshPromise = doRefreshAccessToken().finally(() => {
      isRefreshing = false
    })
  }
  return refreshPromise as Promise<string | null>
}

// ================= 请求拦截：只做 Authorization，不改登录体 =================
http.interceptors.request.use(
  (config: any) => {
    const url = (config?.url || '').toLowerCase()
    const isRefresh = url.includes('/auth/refresh')

    config.headers = { ...(config.headers || {}) }

    if (!isRefresh) {
      const token = getAccessToken()
      if (token) config.headers['Authorization'] = `Bearer ${token}`
    } else {
      if ('Authorization' in config.headers) delete config.headers['Authorization']
    }

    return config
  },
  (error: any) => Promise.reject(error)
)

// ================= 响应拦截：401 自动刷新并重试 =================
http.interceptors.response.use(
  (resp: any) => resp,
  async (error: any) => {
    const original: any = error?.config
    const status = error?.response?.status
    const url = (original?.url || '').toLowerCase()

    const isAuthRoute =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/password-reset')

    const shouldTryRefresh =
      (status === 401 || status === 419 || status === 498) && original && !original._retry && !isAuthRoute

    if (shouldTryRefresh) {
      original._retry = true
      const newToken = await ensureRefresh()
      if (newToken) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` }
        return http(original)
      }
      clearAuthAndRedirect()
      return Promise.reject(error)
    }

    if ((status === 401 || status === 419 || status === 498) && !isAuthRoute) {
      clearAuthAndRedirect()
    }
    return Promise.reject(error)
  }
)

// ================= 统一 API（保持你的原有导出） =================
export const api = {
  get<T = any>(url: string, config?: any) {
    return normalize<T>(http.get(url, config))
  },
  post<T = any>(url: string, data?: any, config?: any) {
    return normalize<T>(http.post(url, data, config))
  },
  put<T = any>(url: string, data?: any, config?: any) {
    return normalize<T>(http.put(url, data, config))
  },
  delete<T = any>(url: string, config?: any) {
    return normalize<T>(http.delete(url, config))
  },
}
