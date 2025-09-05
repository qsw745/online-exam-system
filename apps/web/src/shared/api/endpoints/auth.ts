import { api } from '../core/httpClient'
import { clearAuthAndRedirect } from '../core/storage'

export const auth = {
  login(email: string, password: string) {
    // 约定：登录返回 access token，且服务端设置 refresh HttpOnly Cookie
    return api.post<{ token: string; user: any }>('/auth/login', { email, password })
  },
  register(userData: { email: string; password: string; username: string; role: string }) {
    return api.post('/auth/register', userData)
  },
  refresh() {
    return api.post<{ token: string }>('/auth/refresh')
  },
  async logout() {
    // 若有后端 /auth/logout，调用清 Cookie；即使失败也清前端态
    try {
      await api.post('/auth/logout')
    } finally {
      clearAuthAndRedirect()
    }
  },
}

export const { login, register, logout } = auth
