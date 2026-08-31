import type { Response } from 'express'
import bcrypt from 'bcryptjs'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { SessionStore } from '@/common/session/session.store'
import { AccountDeletionRepository } from '../repositories/account-deletion.repository'
import { AccountDeletionService } from '../services/account-deletion.service'

const service = new AccountDeletionService(AccountDeletionRepository, () => new Date(), {
  verifyPassword: (plain, passwordHash) => bcrypt.compareSync(plain, passwordHash),
  revokeSession: sessionId => SessionStore.revoke(sessionId),
})

export class AccountDeletionController {
  static async preview(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    return res.ok(service.preview(), '注销范围预览')
  }

  static async request(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const userId = Number(req.user?.id)
    if (!userId) return res.unauthorized('请先登录')
    const body = req.body || {}
    const requestId = String(body.requestId || '')
    const mode = body.mode
    const statusToken = String(body.statusToken || '')
    const password = String(body.password || '')
    const confirmationPhrase = String(body.confirmationPhrase || '')
    if (!requestId || !mode || !statusToken || !password || !confirmationPhrase) {
      return res.badRequest('请求编号、注销模式、状态凭证、密码和确认词不能为空')
    }
    const data = await service.request(userId, {
      requestId,
      mode,
      statusToken,
      password,
      confirmationPhrase,
    })
    return res.ok(data, '注销申请已提交，账号尚未完成物理删除')
  }

  static async status(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const body = req.body || {}
    const requestId = String(body.requestId || '')
    const statusToken = String(body.statusToken || '')
    if (requestId || statusToken) {
      if (!requestId || !statusToken) return res.badRequest('请求编号和状态凭证必须同时提供')
      return res.ok(await service.status({ requestId, statusToken }), '注销状态查询成功')
    }
    const email = String(body.email || '')
    const password = String(body.password || '')
    if (!email || !password) return res.badRequest('邮箱和密码不能为空')
    return res.ok(await service.status({ email, password }), '注销状态查询成功')
  }

  static async cancel(req: AuthRequest, res: Response<ApiResponse<any>>) {
    const email = String(req.body?.email || '')
    const password = String(req.body?.password || '')
    if (!email || !password) return res.badRequest('邮箱和密码不能为空')
    return res.ok(await service.cancel({ email, password }), '注销申请已取消，请重新登录')
  }
}
