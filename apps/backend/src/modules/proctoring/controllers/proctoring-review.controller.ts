import type { Response } from 'express'
import { log } from '@/infrastructure/logging/logger'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { ProctoringReviewPolicyError } from '../domain/proctoring-review.policy.js'
import { ProctoringReviewRepository } from '../repositories/proctoring-review.repository.js'
import { ProctoringReviewService } from '../services/proctoring-review.service.js'

const service = new ProctoringReviewService(ProctoringReviewRepository)

const REVIEW_STATUSES = new Set([
  'pending_review',
  'information_requested',
  'decided',
  'appeal_pending',
  'appeal_resolved',
])
const REVIEW_OUTCOMES = new Set(['pending', 'cleared', 'violation_confirmed'])
const REASON_RE = /^[A-Z0-9_]{1,64}$/

const respondError = (res: Response, error: any, fallback: string) => {
  const status = Number(error?.status) || 500
  const code = String(
    error?.code ||
      (status === 404
        ? CODES.NOT_FOUND
        : status === 403
          ? CODES.AUTH_FORBIDDEN
          : status === 401
            ? CODES.AUTH_UNAUTHORIZED
            : status === 400
              ? CODES.VALIDATION_ERROR
              : CODES.INTERNAL_ERROR),
  )
  const message = String(error?.message || fallback)
  if (status >= 500) log.error(`[proctoring-review] ${fallback}:`, error)
  return (res as any).fail(code, status, message)
}

const optionalEnum = (value: unknown, allowed: Set<string>, label: string) => {
  if (value == null || String(value).trim() === '') return undefined
  const normalized = String(value).trim()
  if (!allowed.has(normalized)) {
    throw new ProctoringReviewPolicyError(`${label}无效`, 'PROCTORING_REVIEW_FILTER_INVALID')
  }
  return normalized
}

const optionalPositiveInt = (value: unknown, label: string) => {
  if (value == null || String(value).trim() === '') return undefined
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new ProctoringReviewPolicyError(`${label}无效`, 'PROCTORING_REVIEW_FILTER_INVALID')
  }
  return number
}

const optionalReason = (value: unknown) => {
  if (value == null || String(value).trim() === '') return undefined
  const normalized = String(value).trim().toUpperCase()
  if (!REASON_RE.test(normalized)) {
    throw new ProctoringReviewPolicyError('触发原因无效', 'PROCTORING_REVIEW_FILTER_INVALID')
  }
  return normalized
}

const buildContentDisposition = (filenameAscii: string, filenameUtf8: string) => {
  const safeAscii = filenameAscii.replace(/[^A-Za-z0-9._-]/g, '_')
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filenameUtf8)}`
}

export class ProctoringReviewController {
  static async listStaffCases(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const status = optionalEnum(req.query.status, REVIEW_STATUSES, '案件状态')
      const outcome = optionalEnum(req.query.outcome, REVIEW_OUTCOMES, '案件结论')
      const data = await service.listStaffCases(req.user as any, {
        status: status as any,
        outcome: outcome as any,
        examId: optionalPositiveInt(req.query.examId, '考试编号'),
        reasonCode: optionalReason(req.query.reasonCode),
        page: optionalPositiveInt(req.query.page, '页码'),
        limit: optionalPositiveInt(req.query.limit, '每页数量'),
      })
      return (res as any).ok(data, '获取监考复核队列成功')
    } catch (error: any) {
      return respondError(res, error, '获取监考复核队列失败')
    }
  }

  static async getStaffCase(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getStaffCase(req.user as any, req.params.caseId)
      return (res as any).ok(data, '获取监考复核案件成功')
    } catch (error: any) {
      return respondError(res, error, '获取监考复核案件失败')
    }
  }

  static async decideCase(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const body = req.body || {}
      const data = await service.decideCase(
        req.user as any,
        req.params.caseId,
        {
          decisionId: body.decisionId,
          action: body.action,
          reasonCode: body.reasonCode,
          comment: body.comment,
          expectedVersion: body.expectedVersion,
          messageId: body.messageId,
          informationRequest: body.informationRequest,
        },
        req as any,
      )
      return (res as any).ok(data, data.replayed ? '复核操作已确认' : '复核操作已记录')
    } catch (error: any) {
      return respondError(res, error, '处理监考复核案件失败')
    }
  }

  static async exportCaseCsv(req: AuthRequest, res: Response) {
    try {
      const result = await service.exportCaseCsv(req.user as any, req.params.caseId, req as any)
      res.set('Content-Type', 'text/csv; charset=utf-8')
      res.set('Content-Disposition', buildContentDisposition(result.filenameAscii, result.filenameUtf8))
      return res.status(200).send(result.csv)
    } catch (error: any) {
      return respondError(res, error, '导出监考复核案件失败')
    }
  }

  static async listMyCases(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.listMyCases(req.user as any, {
        attemptId: req.query.attemptId,
        page: optionalPositiveInt(req.query.page, '页码'),
        limit: optionalPositiveInt(req.query.limit, '每页数量'),
      })
      return (res as any).ok(data, '获取我的监考复核案件成功')
    } catch (error: any) {
      return respondError(res, error, '获取我的监考复核案件失败')
    }
  }

  static async getMyCase(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getMyCase(req.user as any, req.params.caseId)
      return (res as any).ok(data, '获取我的监考复核案件成功')
    } catch (error: any) {
      return respondError(res, error, '获取我的监考复核案件失败')
    }
  }

  static async respond(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const body = req.body || {}
      const data = await service.respondToInformationRequest(
        req.user as any,
        req.params.caseId,
        {
          messageId: body.messageId,
          replyToMessageId: body.replyToMessageId,
          body: body.body,
          expectedVersion: body.expectedVersion,
        },
        req as any,
      )
      return (res as any).ok(data, data.replayed ? '补充说明已确认' : '补充说明已提交')
    } catch (error: any) {
      return respondError(res, error, '提交复核补充说明失败')
    }
  }

  static async appeal(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const body = req.body || {}
      const data = await service.submitAppeal(
        req.user as any,
        req.params.caseId,
        {
          appealId: body.appealId,
          reasonCode: body.reasonCode,
          statement: body.statement,
          expectedVersion: body.expectedVersion,
        },
        req as any,
      )
      return (res as any).ok(data, data.replayed ? '申诉已确认' : '申诉已提交')
    } catch (error: any) {
      return respondError(res, error, '提交监考复核申诉失败')
    }
  }
}

export default ProctoringReviewController
