import { api } from '../core/httpClient'
import { clearAuthAndRedirect } from '../core/storage'

/** 你项目里常用的返回壳，按需调整 */
export type ApiResult<T = any> = { success: boolean; data?: T; error?: string }

/** ======== 认证 ======== */
export const auth = {
  login(email: string, password: string) {
    return api.post<ApiResult<{ token: string; user: any }>>('/auth/login', { email, password })
  },
  register(userData: { email: string; password: string; username: string; role: string }) {
    return api.post<ApiResult>('/auth/register', userData)
  },
  // 如果你的后端是 GET /auth/refresh，请改成 api.get
  refresh() {
    return api.post<ApiResult<{ token: string }>>('/auth/refresh', undefined)
  },
  async logout() {
    try {
      await api.post<ApiResult>('/auth/logout')
    } finally {
      clearAuthAndRedirect()
    }
  },

  /** ======== 找回/重置密码 ======== */
  /** 对应后端：POST /auth/password-reset/forgot-password */
  forgotPassword(email: string) {
    return api.post<ApiResult<{ message: string }>>('/auth/password-reset/forgot-password', { email })
  },

  /** 对应后端：GET /auth/password-reset/validate-token/:token  */
  validateResetToken(token: string) {
    return api.get<ApiResult<{ valid: boolean; email?: string }>>(
      `/auth/password-reset/validate-token/${encodeURIComponent(token)}`
    )
  },

  /** 对应后端：POST /auth/password-reset/reset-password */
  resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return api.post<ApiResult<{ message: string }>>('/auth/password-reset/reset-password', {
      token,
      newPassword,
      confirmPassword,
    })
  },
}

export const { login, register, refresh, logout, forgotPassword, validateResetToken, resetPassword } = auth
