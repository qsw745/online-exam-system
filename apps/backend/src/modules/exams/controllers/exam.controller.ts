// apps/backend/src/modules/exams/controllers/exam.controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { ExamListData, ExamDetailData, IExam } from '../domain/exam.model'
import { ExamService } from '../services/exam.service'

const svc = new ExamService()

export class ExamController {
  static async list(req: AuthRequest, res: Response<ApiResponse<ExamListData>>) {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1)
      const limit = Math.max(parseInt(req.query.limit as string) || 10, 1)
      const status = (req.query.status as string | undefined)?.toLowerCase()
      const search = (req.query.search as string) || ''
      const data = await svc.list({ page, limit, status, search })
      return (res as any).ok(data, '获取考试列表成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '获取考试列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<ExamDetailData>>) {
    try {
      const examId = Number(req.params.id)
      if (Number.isNaN(examId)) return (res as any).badRequest('无效的考试ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.getById(examId)
      return (res as any).ok(data, '获取考试详情成功')
    } catch (e: any) {
      const notFound = /不存在/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '考试不存在')
      return (res as any).internal(e?.message || '获取考试详情失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<IExam>>) {
    try {
      const userId = req.user?.id
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      const exam = await svc.create(userId, req.body)
      return (res as any).created(exam, '创建考试成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '创建考试失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<IExam>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(examId)) return (res as any).badRequest('无效的考试ID', { code: CODES.VALIDATION_ERROR })
      const exam = await svc.update(userId, examId, req.body)
      return (res as any).ok(exam, '更新考试成功')
    } catch (e: any) {
      const notFound = /不存在|权限/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '考试不存在或无权限')
      return (res as any).internal(e?.message || '更新考试失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async submitReview(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(examId)) return (res as any).badRequest('无效的考试ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.submitReview(userId, examId, req.body || {})
      return (res as any).ok(data, '提交审核成功')
    } catch (e: any) {
      const msg = e?.message || '提交审核失败'
      if (/不存在|权限/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
      if (/缺少|不足|无效/.test(msg)) return (res as any).badRequest(msg, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(examId)) return (res as any).badRequest('无效的考试ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove(userId, examId)
      return (res as any).ok(null, '删除考试成功')
    } catch (e: any) {
      const notFound = /不存在|权限/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '考试不存在或无权限')
      return (res as any).internal(e?.message || '删除考试失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async start(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      await svc.start(userId, examId)
      return (res as any).ok(null, '开始考试成功')
    } catch (e: any) {
      const bad = /不存在|发布|开始|结束|已经开始/.test(e?.message)
      if (bad) return (res as any).badRequest(e?.message, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(e?.message || '开始考试失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async submit(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      await svc.submit(userId, examId, req.body?.answers || {}, req)
      return (res as any).ok(null, '提交成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '提交考试失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
