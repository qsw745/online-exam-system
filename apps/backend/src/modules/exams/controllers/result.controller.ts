import type { Response } from 'express'
import type { ApiResponse } from 'types/response.js'
import type { AuthRequest } from 'types/auth.js'
import type { ResultListData } from '../domain/result.model'
import { ResultService } from '../services/result.service'

const svc = new ResultService()

export class ResultController {
  static async list(req: AuthRequest, res: Response<ApiResponse<ResultListData>>) {
    try {
      const data = await svc.list(req.user, req.query)
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /未授权/.test(e?.message) ? 401 : 500
      return res.status(code).json({ success: false, error: e?.message || '获取考试结果列表失败' })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await svc.getById(req.user?.id, Number(req.params.id))
      return res.json({ success: true, data })
    } catch (e: any) {
      const msg = e?.message || '获取考试结果详情失败'
      const code = /未授权/.test(msg) ? 401 : /不存在/.test(msg) ? 404 : 500
      return res.status(code).json({ success: false, error: msg })
    }
  }
}
