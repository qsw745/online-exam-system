import { api } from '../core/httpClient'
import { clearAuthAndRedirect } from '../core/storage'

export const auth = {
  login(email: string, password: string) {
    return api.post<{ token: string; user: any }>('/auth/login', { email, password })
  },
  register(userData: { email: string; password: string; username: string; role: string }) {
    return api.post('/auth/register', userData)
  },
  refresh() {
    return api.post<{ token: string }>('/auth/refresh')
  },
  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      clearAuthAndRedirect()
    }
  },

  // ✅ 补齐：忘记密码（发送重置邮件/验证码）
  forgotPassword(email: string) {
    // 常见约定：POST /auth/forgot-password { email }
    return api.post<{ message: string }>('/auth/forgot-password', { email })
  },

  // ✅ 补齐：校验重置令牌是否有效
  validateResetToken(token: string) {
    // 常见约定：GET /auth/reset-password/validate?token=xxx
    // 如果你的 httpClient 对 GET 的 params 需要写法不同，按项目约定改一下
    return api.get<{ valid: boolean }>('/auth/reset-password/validate', { params: { token } })
  },

  // ✅ 补齐：提交新密码
  resetPassword(payload: { token: string; newPassword: string }) {
    // 常见约定：POST /auth/reset-password { token, password }
    // 如果后端字段是 new_password，就把 password 改成 new_password
    return api.post<{ message: string }>('/auth/reset-password', {
      token: payload.token,
      password: payload.newPassword,
    })
  },
}

// 维持原有导出 + 补齐新方法（可选：也可以只导出 auth 一个对象）
export const { login, register, refresh, logout, forgotPassword, validateResetToken, resetPassword } = auth
