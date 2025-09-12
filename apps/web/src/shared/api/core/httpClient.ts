import axios from 'axios'
import { normalize } from './normalize'
import { clearAuthAndRedirect, getAccessToken, setAccessToken } from './storage'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
const baseURL = import.meta.env.DEV ? '/api' : API_URL

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

// ================= 刷新令牌并发控制 =================
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

function pickAccessToken(respData: any): string | null {
  // 兼容多种返回形态
  if (!respData) return null
  const d = respData.data ?? respData
  return d?.token ?? d?.access_token ?? d?.accessToken ?? d?.jwt ?? null
}

async function postRefresh(): Promise<string | null> {
  // ⚠️ 不传 body，也不要手动塞 Authorization
  const resp = await http.post('/auth/refresh') // 无请求体
  const token = pickAccessToken(resp?.data)
  if (typeof token === 'string' && token) {
    setAccessToken(token)
    return token
  }
  return null
}

async function getRefresh(): Promise<string | null> {
  const resp = await http.get('/auth/refresh')
  const token = pickAccessToken(resp?.data)
  if (typeof token === 'string' && token) {
    setAccessToken(token)
    return token
  }
  return null
}

async function doRefreshAccessToken(): Promise<string | null> {
  try {
    // 优先 POST，无 body；失败再试 GET
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

// ================= 请求拦截：加 Authorization（跳过刷新接口） =================
http.interceptors.request.use(
  (config: any) => {
    const url = (config?.url || '').toLowerCase()
    const isRefresh = url.includes('/auth/refresh')

    // 统一成普通对象，避免 AxiosHeaders 类型依赖
    config.headers = { ...(config.headers || {}) }

    if (!isRefresh) {
      const token = getAccessToken()
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    } else {
      // ✅ 确保刷新请求完全不带 Authorization
      if ('Authorization' in config.headers) {
        delete config.headers['Authorization']
      }
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
