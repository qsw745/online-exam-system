import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { EmailVerificationService } from '../services/email-verification.service'

export class EmailVerificationController {
  /** 校验邮箱验证 token */
  static async verify(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const token = String((req.body?.token ?? req.query?.token) || '')
    if (!token) return (res as any).badRequest('缺少验证 token')
    const { ok } = await EmailVerificationService.verify(token)
    if (!ok) return (res as any).badRequest('验证链接无效或已过期，请重新发送验证邮件')
    return (res as any).ok({ verified: true }, '邮箱验证成功，请登录')
  }

  /** 重新发送验证邮件（对未验证账号；不暴露账号是否存在） */
  static async resend(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const email = String(req.body?.email || '').trim()
    if (!email) return (res as any).badRequest('请填写邮箱')
    await EmailVerificationService.resend(email)
    return (res as any).ok({ sent: true }, '若该邮箱存在且未验证，验证邮件已发送')
  }
}
