/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { PaperData, PaperListData, PaperQuestionData } from '../domain/paper.model'
import { PaperService } from '../services/paper.service'

const svc = new PaperService()

export class PaperController {
  static async addQuestion(req: AuthRequest, res: Response<ApiResponse<{ questionId: number }>>) {
    try {
      const paperId = Number(req.params.id)
      const data = await svc.addQuestion(paperId, req.body)
      return (res as any).created(data, '题目添加成功')
    } catch (e: any) {
      if (e?.code === 'BAD_REQUEST') return (res as any).badRequest(e.message, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(e?.message || '添加试卷题目失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async removeQuestion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const affected = await svc.removeQuestion(Number(req.params.id), Number(req.params.questionId))
      if (!affected) return (res as any).fail(CODES.NOT_FOUND, 404, '试卷题目不存在')
      return (res as any).ok(null, '移除成功')
    } catch (e: any) {
      if (e?.code === 'BAD_REQUEST') return (res as any).badRequest(e.message, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(e?.message || '移除试卷题目失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getQuestions(req: AuthRequest, res: Response<ApiResponse<PaperQuestionData>>) {
    try {
      const data = await svc.getQuestions(Number(req.params.id))
      return (res as any).ok(data, '获取成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '获取试卷题目列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async updateQuestionOrder(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const orders = req.body?.orders
      if (!Array.isArray(orders) || orders.length === 0) {
        // 使用 400 + VALIDATION_ERROR，避免 BAD_REQUEST 常量不存在
        return (res as any).fail(CODES.VALIDATION_ERROR, 400, '无效的题目顺序数据')
      }
      await svc.updateOrder(Number(req.params.id), orders)
      return (res as any).ok(null, '更新题目顺序成功')
    } catch (e: any) {
      if (e?.code === 'BAD_REQUEST') return (res as any).badRequest(e.message, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(e?.message || '更新试卷题目顺序失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<PaperListData>>) {
    try {
      const page = Math.max(1, Number(req.query.page ?? 1))
      const limit = Math.max(1, Number(req.query.limit ?? 10))
      const offset = Number.isFinite(Number(req.query.offset)) ? Number(req.query.offset) : (page - 1) * limit
      const difficulty = (req.query.difficulty as any) || undefined

      const data = await svc.list({ difficulty, limit, offset })
      return (res as any).ok(data, '获取试卷列表成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '获取试卷列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const data = await svc.getById(Number(req.params.id))
      return (res as any).ok(data, '获取试卷详情成功')
    } catch (e: any) {
      const notFound = /不存在/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '试卷不存在')
      return (res as any).internal(e?.message || '获取试卷详情失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const data = await svc.create(req.body)
      return (res as any).created(data, '创建试卷成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '创建试卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const data = await svc.update(Number(req.params.id), req.body)
      return (res as any).ok(data, '更新试卷成功')
    } catch (e: any) {
      const notFound = /不存在/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '试卷不存在')
      return (res as any).internal(e?.message || '更新试卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async updateWorkflow(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const paperId = Number(req.params.id)
      if (!req.user?.id) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(paperId)) return (res as any).badRequest('无效的试卷ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.updateWorkflow(paperId, req.body || {})
      return (res as any).ok(data, '更新审批配置成功')
    } catch (e: any) {
      const msg = e?.message || '更新审批配置失败'
      if (/不存在/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
      return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
    }
  }

  static async submitReview(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const paperId = Number(req.params.id)
      const userId = req.user?.id
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(paperId)) return (res as any).badRequest('无效的试卷ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.submitReview(userId, paperId, req.body || {})
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
      await svc.remove(Number(req.params.id))
      return (res as any).ok(null, '删除试卷成功')
    } catch (e: any) {
      const notFound = /不存在/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '试卷不存在')
      if (e?.code === 'BAD_REQUEST') return (res as any).badRequest(e.message, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(e?.message || '删除试卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** ✅ 智能组卷：实现并返回 201 */
  static async smartGenerate(req: AuthRequest, res: Response) {
    try {
      const data = await svc.smartGenerate(req.body)
      return (res as any).created(data, '智能组卷成功')
    } catch (e: any) {
      // 输入校验或题库不足 → 400；其余视为 500
      if (e?.code === 'BAD_REQUEST' || e?.code === 'NOT_ENOUGH_QUESTIONS') {
        return (res as any).fail(CODES.VALIDATION_ERROR, 400, e.message || '请求参数错误')
      }
      return (res as any).internal(e?.message || '智能组卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async createWithQuestions(req: AuthRequest, res: Response) {
    try {
      const data = await svc.createWithQuestions(req.body)
      return (res as any).ok(data, '创建试卷成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '创建试卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** ✅ 题库检索（分页） */
  static async searchBank(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const page = Math.max(1, Number(req.query.page ?? 1))
      const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 10)))
      const search = (req.query.search as string) || ''
      const difficulty = (req.query.difficulty as any) || undefined
      const type = (req.query.type as any) || undefined

      const { items, total } = await svc.searchBank({ page, limit, search, difficulty, type })
      return (res as any).ok({ items, total }, '获取题库成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '获取题库失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** ✅ 向试卷添加“手工录入题目”（以快照写入 paper_questions） */
  static async addCustomQuestion(req: AuthRequest, res: Response<ApiResponse<{ id: number }>>) {
    try {
      const paperId = Number(req.params.id)
      const b = req.body ?? {}
      const data = await svc.addCustomQuestion(paperId, {
        type: b.question_type,
        content: b.content,
        options: b.options,
        answer: b.answer,
        score: Number(b.score || 5),
        order: Number(b.order || 1),
      })
      return (res as any).created(data, '手工题添加成功')
    } catch (e: any) {
      if (e?.code === 'BAD_REQUEST') return (res as any).badRequest(e.message, { code: CODES.VALIDATION_ERROR })
      return (res as any).internal(e?.message || '添加手工题失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
