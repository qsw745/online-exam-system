import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosRequestConfig } from 'axios'
import { normalize } from './normalize'
import { clearAuthAndRedirect, getAccessToken, setAccessToken } from './storage'

export const API_URL = import.meta.env.VITE_API_URL || '/api'
const baseURL = import.meta.env.DEV ? '/api' : API_URL

// axios 实例
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

// 刷新令牌并发控制
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function doRefreshAccessToken(): Promise<string | null> {
  try {
    const resp = await http.post('/auth/refresh') // 后端从 Cookie 读取 refresh token
    const token = resp?.data?.data?.token || resp?.data?.token
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

// 请求拦截：加 Authorization
http.interceptors.request.use(
  config => {
    const token = getAccessToken()
    if (token) {
      if (!config.headers) config.headers = new AxiosHeaders()
      ;(config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`)
    }
    return config
  },
  error => Promise.reject(error)
)

// 响应拦截：401 自动刷新并重试
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

    if (status === 401 && original && !original._retry && !isAuthRoute) {
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

    if (status === 401 && !isAuthRoute) {
      clearAuthAndRedirect()
    }
    return Promise.reject(error)
  }
)

// 统一“业务友好型” API：返回 ApiResult<T>
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
