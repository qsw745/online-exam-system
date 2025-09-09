import type { Request, Response } from 'express'
import type { ApiResponse } from 'types/response.js'
import { PasswordResetService } from '../services/password-reset.service.js'

const svc = new PasswordResetService()

export class PasswordResetController {
  static async forgotPassword(req: Request, res: Response<ApiResponse<{ success: true; message: string }>>) {
    try {
      const email = String(req.body?.email || '').trim()
      if (!email) return res.status(400).json({ success: false, error: '邮箱地址不能为空' })
      await svc.send(email)
      return res.json({ success: true, data: { success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' } })
    } catch (e: any) {
      const msg = e?.message || '服务器内部错误，请稍后重试'
      const code = /频繁/.test(msg) ? 429 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  }

  static async validateResetToken(req: Request, res: Response<ApiResponse<{ valid: boolean; email?: string }>>) {
    try {
      const token = String(req.params.token || req.body?.token || '')
      if (!token) return res.status(400).json({ success: false, error: '重置令牌不能为空' })
      const { email } = await svc.validate(token)
      return res.json({ success: true, data: { valid: true, email } })
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e?.message || '重置令牌无效或已过期' })
    }
  }

  static async resetPassword(req: Request, res: Response<ApiResponse<{ success: true; message: string }>>) {
    try {
      const { token, newPassword, confirmPassword } = req.body || {}
      if (!token || !newPassword || !confirmPassword)
        return res.status(400).json({ success: false, error: '所有字段都是必填的' })
      if (newPassword !== confirmPassword)
        return res.status(400).json({ success: false, error: '两次输入的密码不一致' })
      if (String(newPassword).length < 6) return res.status(400).json({ success: false, error: '密码长度至少为6位' })
      await svc.reset(token, newPassword)
      return res.json({ success: true, data: { success: true, message: '密码重置成功，请使用新密码登录' } })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '服务器内部错误，请稍后重试' })
    }
  }

  static async cleanExpiredTokens(_req: Request, res: Response<ApiResponse<{ cleaned: number }>>) {
    try {
      const cleaned = await svc.cleanExpired()
      return res.json({ success: true, data: { cleaned } })
    } catch {
      return res.status(500).json({ success: false, error: '清理失败' })
    }
  }
}
