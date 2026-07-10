// apps/web/src/shared/api/endpoints/auth.ts
import { API_URL, api } from '../core/httpClient'
import { clearTokenAll } from '../core/storage'
import type { ApiResult } from '../core/types' // ✅ 仅使用这里的 ApiResult，去掉本文件重复声明

export type FaceLoginCandidate = {
  choiceId: string
  displayName: string
  maskedEmail: string
  role?: string | null
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

  /** 人脸登录：采集帧 → 服务端活体 + 1:N 人脸识别 → 命中返回 token/user。超时 60s */
  faceLoginVerify(payload: { images: string[]; keep7Days?: boolean }) {
    return api.post<{
      matched: boolean
      reason?:
        | 'no_face'
        | 'multiple_faces'
        | 'liveness_failed'
        | 'not_enrolled'
        | 'verification_failed'
        | 'multiple_matches'
      message?: string
      token?: string
      user?: any
      similarity?: number
      selectionRequired?: boolean
      ticket?: string
      candidates?: FaceLoginCandidate[]
      expiresIn?: number
    }>('/auth/face-login', payload, { timeout: 60000 })
  },

  /** 多账号人脸命中后，使用后端一次性票据选择要进入的账号 */
  faceLoginSelect(payload: { ticket: string; choiceId: string }) {
    return api.post<{
      matched: boolean
      token?: string
      user?: any
      similarity?: number
    }>('/auth/face-login/select', payload, { timeout: 15000 })
  },

  /** 校验注册邮箱验证 token */
  verifyEmail(token: string) {
    return api.post<{ verified: boolean }>('/auth/verify-email', { token })
  },

  /** 重新发送验证邮件 */
  resendVerification(email: string) {
    return api.post<{ sent: boolean }>('/auth/verify-email/resend', { email })
  },

  /** PC：生成扫码登录二维码票据，手机端刷脸后按识别到的用户登录 */
  qrCreate(payload: { keep7Days?: boolean }) {
    return api.post<{ ticketId: string; pollToken: string; expiresIn: number }>('/auth/qr/create', payload)
  },

  /** PC：轮询票据状态，confirmed 时返回 token/user */
  qrPoll(ticketId: string, pollToken: string) {
    return api.get<{
      status: 'pending' | 'scanned' | 'confirmed' | 'expired' | 'invalid'
      token?: string
      user?: any
    }>('/auth/qr/poll', { params: { ticket: ticketId, pollToken } })
  },

  /** 手机：打开二维码页（标记已扫描） */
  qrInfo(ticketId: string) {
    return api.get<{ status: 'pending' | 'scanned' | 'confirmed' | 'expired' }>(
      '/auth/qr/info',
      { params: { ticket: ticketId } }
    )
  },

  /** 手机：刷脸授权 */
  qrAuthorize(payload: { ticket: string; images: string[] }) {
    return api.post<{ ok: boolean; reason?: string; message?: string; candidates?: FaceLoginCandidate[] }>(
      '/auth/qr/authorize',
      payload,
      {
        timeout: 60000,
      }
    )
  },

  /** 手机：多账号命中时选择要授权登录的账号 */
  qrSelect(payload: { ticket: string; choiceId: string }) {
    return api.post<{ ok: boolean; reason?: string; message?: string }>('/auth/qr/select', payload, {
      timeout: 60000,
    })
  },

  /** 查询本人人脸录入状态 */
  faceStatus() {
    return api.get<{ enrolled: boolean; samples: number; model: string | null; updatedAt: string | null }>(
      '/auth/face/status'
    )
  },

  /** 录入本人人脸凭据（需本人同意）；images 为 1-8 帧 base64。CPU 推理较慢，放宽超时到 60s */
  faceEnroll(payload: { images: string[]; consent: boolean }) {
    return api.post<{ enrolled: boolean; samples: number; model: string | null; updatedAt: string | null }>(
      '/auth/face/enroll',
      payload,
      { timeout: 60000 }
    )
  },

  /** 解绑本人人脸凭据 */
  faceUnenroll() {
    return api.delete<{ removed: number }>('/auth/face/enroll')
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

  oauthProviders() {
    return api.get<ApiResult<{ providers: Array<{ provider: 'github' | 'google'; enabled: boolean }> }>>(
      '/auth/oauth/providers'
    )
  },

  oauthStartUrl(provider: 'github' | 'google', opts?: { keep7Days?: boolean; next?: string }) {
    const base = String(API_URL || '/api').replace(/\/+$/, '')
    const params = new URLSearchParams()
    if (opts?.keep7Days) params.set('keep7Days', '1')
    if (opts?.next) params.set('next', opts.next)
    const qs = params.toString()
    return `${base}/auth/oauth/${provider}/start${qs ? `?${qs}` : ''}`
  },
}

export const { login, register, refresh, logout, forgotPassword, validateResetToken, resetPassword, captchaNew } = auth
