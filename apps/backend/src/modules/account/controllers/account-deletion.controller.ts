import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { AccountDeletionService } from '../services/account-deletion.service'

const service = new AccountDeletionService()

export class AccountDeletionController {
  static async preview(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    return res.ok(service.preview(), '注销范围预览')
  }

  static async request(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = Number(req.user?.id)
    if (!userId) return res.unauthorized('请先登录')
    const { password, confirmationPhrase } = req.body || {}
    if (!password || !confirmationPhrase) return res.badRequest('密码和确认词不能为空')
    const data = await service.request(userId, String(password), String(confirmationPhrase))
    return res.ok(data, '注销申请已提交，账号尚未完成物理删除')
  }

  static async status(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { email, password } = req.body || {}
    if (!email || !password) return res.badRequest('邮箱和密码不能为空')
    return res.ok(await service.status(String(email), String(password)), '注销状态查询成功')
  }

  static async cancel(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const { email, password } = req.body || {}
    if (!email || !password) return res.badRequest('邮箱和密码不能为空')
    return res.ok(await service.cancel(String(email), String(password)), '注销申请已取消，请重新登录')
  }
}
