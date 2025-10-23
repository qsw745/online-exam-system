// apps/web/src/shared/api/endpoints/auth.ts
import { api } from '../core/httpClient'
import { clearTokenAll } from '../core/storage'
import type { ApiResult } from '../core/types' // ✅ 仅使用这里的 ApiResult，去掉本文件重复声明

let _lastRedirectAt = 0
function redirectToLogin(path = '/login') {
  try {
    const now = Date.now()
    const alreadyOnLogin = typeof window !== 'undefined' && window.location?.pathname === path
    if (!alreadyOnLogin && now - _lastRedirectAt > 2000) {
      _lastRedirectAt = now
      window.location.assign(path)
    }
  } catch {}
}

export const auth = {
  /** 登录：如有 enc/alg（前端已加密）优先发加密字段；否则发明文（兼容旧后端） */
  login(
    email: string,
    password: string,
    extra?: { captcha?: string; captchaId?: string; enc?: string; alg?: string; keep7Days?: boolean } // ✅
  ) {
    const hasEnc = !!(extra?.enc && extra?.alg)
    const body: any = hasEnc
      ? {
          enc: extra!.enc,
          alg: extra!.alg,
          keep7Days: !!extra?.keep7Days, // ✅ 传后端

          ...(extra?.captcha ? { captcha: extra.captcha } : {}),
          ...(extra?.captchaId ? { captchaId: extra.captchaId } : {}),
        }
      : {
          email,
          password,
          keep7Days: !!extra?.keep7Days, // ✅ 传后端

          ...(extra?.captcha ? { captcha: extra.captcha } : {}),
          ...(extra?.captchaId ? { captchaId: extra.captchaId } : {}),
        }

    const headers = hasEnc ? { 'X-Cred-Enc': String(extra!.enc), 'X-Cred-Alg': String(extra!.alg) } : undefined
    return api.post<ApiResult<{ token: string; user: any }>>('/auth/login', body, { headers })
  },

  register(userData: { email: string; password: string; username?: string | null; nickname?: string | null; keep7Days?: boolean }) {
    return api.post<ApiResult<{ token: string; user: any }>>('/auth/register', userData)
  },

  refresh() {
    return api.post<ApiResult<{ token: string }>>('/auth/refresh', undefined)
  },

  async logout() {
    try {
      await api.post<ApiResult>('/auth/logout')
    } finally {
      try {
        // 仅清除易变登录态：token/角色。保留“记住我”和“7天免登录”偏好。
        clearTokenAll()
        localStorage.removeItem('user_role')
        sessionStorage.removeItem('user_role')
      } catch {}
      // 通知登录页：刷新输入框/勾选状态
      try {
        window.dispatchEvent(new CustomEvent('auth:logout'))
      } catch {}
      redirectToLogin('/login')
    }
  },

  forgotPassword(email: string) {
    return api.post<ApiResult<{ message: string }>>('/auth/password-reset/forgot-password', { email })
  },

  validateResetToken(token: string) {
    return api.get<ApiResult<{ valid: boolean; email?: string }>>(
      `/auth/password-reset/validate-token/${encodeURIComponent(token)}`
    )
  },

  resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return api.post<ApiResult<{ message: string }>>('/auth/password-reset/reset-password', {
      token,
      newPassword,
      confirmPassword,
    })
  },

  /** 验证码：支持 {success:false,error} 的提示 */
  captchaNew() {
    // 兼容有壳/无壳两种返回
    return api.get<ApiResult<{ id: string; svg: string }> | { id: string; svg: string }>('/captcha/new.json', {
      params: { t: Date.now() },
    })
  },
}

export const { login, register, refresh, logout, forgotPassword, validateResetToken, resetPassword, captchaNew } = auth
