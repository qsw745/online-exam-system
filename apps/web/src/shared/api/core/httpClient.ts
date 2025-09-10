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
  withCredentials: true, // 携带 HttpOnly 刷新令牌
})

// ============= 刷新令牌并发控制 =============
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

function pickAccessToken(respData: any): string | null {
  // 兼容多种返回形态：{success:true,data:{token}} / {token} / {access_token} / {data:{access_token}} ...
  if (!respData) return null
  const d = respData.data ?? respData
  return d?.token ?? d?.access_token ?? d?.accessToken ?? d?.jwt ?? null
}

async function doRefreshAccessToken(): Promise<string | null> {
  try {
    const resp = await http.post('/auth/refresh', null, {
      // 很关键：刷新接口**不要**带 Authorization，否则后端可能按 access 逻辑校验
      headers: { Authorization: '' },
    })
    const token = pickAccessToken(resp?.data)
    if (typeof token === 'string' && token) {
      setAccessToken(token)
      return token
    }
    return null
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

// ============= 请求拦截：加 Authorization（但跳过刷新接口） =============
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
    }
    return config
  },
  error => Promise.reject(error)
)

// ============= 响应拦截：401 自动刷新并重试（非认证路由） =============
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

    // 只有非认证路由的 401 才会触发刷新
    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true
      const newToken = await ensureRefresh()
      if (newToken) {
        if (!original.headers) original.headers = new AxiosHeaders()
        ;(original.headers as AxiosHeaders).set('Authorization', `Bearer ${newToken}`)
        return http(original)
      }
      // 刷新失败才清理并跳转
      clearAuthAndRedirect()
      return Promise.reject(error)
    }

    // 非 auth 路由的 401，拦截器之外的情况也清理（比如没有 original）
    if (status === 401 && !isAuthRoute) {
      clearAuthAndRedirect()
    }
    return Promise.reject(error)
  }
)

// 统一 API（保持你的原有导出）
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
