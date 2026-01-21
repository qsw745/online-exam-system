import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { ProctoringService } from '../services/proctoring.service'
import { log } from '@/infrastructure/logging/logger'

const svc = new ProctoringService()

export class ProctoringController {
  static async reportEvent(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const payload = req.body || {}
      const data = await svc.recordEvent(req.user, payload, req as any)
      return (res as any).ok(data, '记录监管事件成功')
    } catch (e: any) {
      const msg = e?.message || '记录监管事件失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      if (/缺少/.test(msg)) return (res as any).fail(CODES.VALIDATION_ERROR, 400, msg)
      log.error('[proctoring] 记录事件失败:', e)
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listExamEvents(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const examId = Number(req.params.examId)
      if (!Number.isFinite(examId) || examId <= 0) {
        return (res as any).fail(CODES.VALIDATION_ERROR, 400, '考试ID无效')
      }
      const data = await svc.listExamEvents(req.user, examId, req.query)
      return (res as any).ok(data, '获取监管记录成功')
    } catch (e: any) {
      const msg = e?.message || '获取监管记录失败'
      if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
      log.error('[proctoring] 查询失败:', e)
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }
}

export default ProctoringController
