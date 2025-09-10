import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios'
import { normalize } from './normalize'
import { clearAuthAndRedirect, getAccessToken, setAccessToken } from './storage'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
const baseURL = import.meta.env.DEV ? '/api' : API_URL

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
  withCredentials: true, // 携带 HttpOnly 刷新令牌 Cookie
})

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
  // ⚠️ 关键修复：不传 body（undefined），也不要手动塞 Authorization
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
    // 优先按你当前约定的 POST，无 body；失败再试 GET（部分后端是 GET）
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
  config => {
    const url = (config.url || '').toLowerCase()
    const isRefresh = url.includes('/auth/refresh')

    if (!isRefresh) {
      const token = getAccessToken()
      if (token) {
        if (!config.headers) config.headers = new AxiosHeaders()
        ;(config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`)
      }
    } else {
      // ✅ 确保刷新请求完全不带 Authorization（有些代理/网关对空值也会误判）
      if (!config.headers) config.headers = new AxiosHeaders()
      // 删除可能的默认头
      if ((config.headers as any).Authorization) {
        ;(config.headers as AxiosHeaders).delete?.('Authorization')
      }
    }
    return config
  },
  error => Promise.reject(error)
)

// ================= 响应拦截：401 自动刷新并重试 =================
http.interceptors.response.use(
  resp => resp,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const url = (original?.url || '').toLowerCase()

    const isAuthRoute =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/password-reset')

    // 多数后端用 401，也有 419/498 等自定义过期码，按需补充
    const shouldTryRefresh =
      (status === 401 || status === 419 || status === 498) && original && !original._retry && !isAuthRoute

    if (shouldTryRefresh) {
      original._retry = true
      const newToken = await ensureRefresh()
      if (newToken) {
        if (!original.headers) original.headers = new AxiosHeaders()
        ;(original.headers as AxiosHeaders).set('Authorization', `Bearer ${newToken}`)
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
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return normalize<T>(http.get(url, config))
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return normalize<T>(http.post(url, data, config))
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return normalize<T>(http.put(url, data, config))
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return normalize<T>(http.delete(url, config))
  },
}
