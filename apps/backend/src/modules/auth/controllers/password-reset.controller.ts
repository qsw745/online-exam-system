// apps/backend/src/modules/auth/controllers/password-reset.controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { PasswordResetService } from '../services/password-reset.service'

const svc = new PasswordResetService()

export class PasswordResetController {
  static async forgotPassword(req: Request, res: Response<ApiResponse<{ success: true; message: string }>>) {
    try {
      const email = String(req.body?.email || '').trim()
      if (!email) return (res as any).badRequest('邮箱地址不能为空', { code: CODES.VALIDATION_ERROR })
      await svc.send(email)
      return (res as any).ok({ success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' }, '请求已受理')
    } catch (e: any) {
      const msg = e?.message || '服务器内部错误，请稍后重试'
      if (/频繁/.test(msg)) return (res as any).tooMany(msg, { code: CODES.RATE_LIMITED, error: { retryAfter: 300 } })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async validateResetToken(req: Request, res: Response<ApiResponse<{ valid: boolean; email?: string }>>) {
    try {
      const token = String(req.params.token || req.body?.token || '')
      if (!token) return (res as any).badRequest('重置令牌不能为空', { code: CODES.VALIDATION_ERROR })
      const { email } = await svc.validate(token)
      return (res as any).ok({ valid: true, email }, '令牌有效')
    } catch (e: any) {
      // 没有 AUTH_BAD_TOKEN 常量，使用 VALIDATION_ERROR + 400
      return (res as any).badRequest(e?.message || '重置令牌无效或已过期', { code: CODES.VALIDATION_ERROR })
    }
  }

  static async resetPassword(req: Request, res: Response<ApiResponse<{ success: true; message: string }>>) {
    try {
      const { token, newPassword, confirmPassword } = req.body || {}
      if (!token || !newPassword || !confirmPassword)
        return (res as any).badRequest('所有字段都是必填的', { code: CODES.VALIDATION_ERROR })
      if (newPassword !== confirmPassword)
        return (res as any).badRequest('两次输入的密码不一致', { code: CODES.VALIDATION_ERROR })
      if (String(newPassword).length < 6)
        return (res as any).badRequest('密码长度至少为6位', { code: CODES.VALIDATION_ERROR })

      await svc.reset(token, newPassword)
      return (res as any).ok({ success: true, message: '密码重置成功，请使用新密码登录' }, '重置成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '服务器内部错误，请稍后重试', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async cleanExpiredTokens(_req: Request, res: Response<ApiResponse<{ cleaned: number }>>) {
    try {
      const cleaned = await svc.cleanExpired()
      return (res as any).ok({ cleaned }, '清理完成')
    } catch {
      return (res as any).internal('清理失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
