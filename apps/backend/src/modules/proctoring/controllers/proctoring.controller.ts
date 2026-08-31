import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { log } from '@/infrastructure/logging/logger'
import { ProctoringService } from '../services/proctoring.service'
import { ProctoringRepository } from '../repositories/proctoring.repository'

const service = new ProctoringService(ProctoringRepository)

const respondError = (res: Response, error: any, fallback: string) => {
  const status = Number(error?.status) || 500
  const code = String(error?.code || (status === 404 ? CODES.NOT_FOUND : status === 401 ? CODES.AUTH_UNAUTHORIZED : CODES.INTERNAL_ERROR))
  const message = String(error?.message || fallback)
  if (status >= 500) log.error(`[proctoring] ${fallback}:`, error)
  return (res as any).fail(code, status, message)
}

export class ProctoringController {
  static async legacyReportEvent(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    return (res as any).fail(
      'LEGACY_PROCTORING_EVENT_DISABLED',
      409,
      '旧版无会话监考事件接口已停用，请升级客户端',
    )
  }

  static async createConsent(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.createConsent(req.user, req.body || {}, req as any)
      return (res as any).created(data, '已记录本场严格监考单独同意')
    } catch (error: any) {
      return respondError(res, error, '记录严格监考同意失败')
    }
  }

  static async createSession(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.createSession(req.user, req.body || {})
      return (res as any).created(data, '监考会话已准备')
    } catch (error: any) {
      return respondError(res, error, '创建监考会话失败')
    }
  }

  static async getSession(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getSession(req.user, req.params.sessionId)
      return (res as any).ok(data, 'OK')
    } catch (error: any) {
      return respondError(res, error, '获取监考会话失败')
    }
  }

  static async recordFactualEvent(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.recordFactualEvent(req.user, req.params.sessionId, req.body || {})
      return (res as any).ok(data, data.replayed ? '监考事件已确认' : '监考事实事件已记录')
    } catch (error: any) {
      return respondError(res, error, '记录监考事实事件失败')
    }
  }

  static async heartbeat(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.heartbeat(req.user, req.params.sessionId, req.body || {})
      return (res as any).ok(data, '监考心跳已确认')
    } catch (error: any) {
      return respondError(res, error, '监考心跳失败')
    }
  }

  static async verifyIdentity(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.verifyIdentity(req.user, req.params.sessionId, req.body || {})
      return (res as any).ok(data, data.result?.result === 'passed' ? '身份核验通过' : '身份核验未通过')
    } catch (error: any) {
      return respondError(res, error, '严格监考身份核验失败')
    }
  }

  static async complete(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.complete(req.user, req.params.sessionId, req.body || {})
      return (res as any).ok(data, '监考会话已结束')
    } catch (error: any) {
      return respondError(res, error, '结束监考会话失败')
    }
  }

  static async listExamEvents(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const examId = Number(req.params.examId)
      if (!Number.isFinite(examId) || examId <= 0) {
        return (res as any).fail(CODES.VALIDATION_ERROR, 400, '考试ID无效')
      }
      const data = await service.listExamEvents(req.user, examId, req.query)
      return (res as any).ok(data, '获取监考记录成功')
    } catch (error: any) {
      return respondError(res, error, '获取监考记录失败')
    }
  }
}

export default ProctoringController
