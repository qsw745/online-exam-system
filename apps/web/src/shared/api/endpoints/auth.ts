import { api } from '../core/httpClient'
import { clearAuthAndRedirect } from '../core/storage'

export const auth = {
  login(email: string, password: string) {
    return api.post<{ token: string; user: any }>('/auth/login', { email, password })
  },
  register(userData: { email: string; password: string; username: string; role: string }) {
    return api.post('/auth/register', userData)
  },

  // ⚠️ 关键修复：不要传 null，当后端用 Cookie 刷新时，直接无 body
  refresh() {
    // 如果你的后端是 GET /auth/refresh，就把下一行改成：return api.get<{ token: string }>('/auth/refresh')
    return api.post<{ token: string }>('/auth/refresh', undefined)
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      clearAuthAndRedirect()
    }
  },

  // —— 可选：找回/重置密码能力 —— //
  forgotPassword(email: string) {
    return api.post<{ message: string }>('/auth/forgot-password', { email })
  },
  validateResetToken(token: string) {
    return api.get<{ valid: boolean }>('/auth/reset-password/validate', { params: { token } })
  },
  resetPassword(payload: { token: string; newPassword: string }) {
    return api.post<{ message: string }>('/auth/reset-password', {
      token: payload.token,
      password: payload.newPassword,
    })
  },
}

export const { login, register, refresh, logout, forgotPassword, validateResetToken, resetPassword } = auth
