// apps/backend/src/modules/exams/controllers/paper.controller.ts
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
      return (res as any).internal(e?.message || '添加试卷题目失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async removeQuestion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const affected = await svc.removeQuestion(Number(req.params.id), Number(req.params.questionId))
      if (!affected) return (res as any).fail(CODES.NOT_FOUND, 404, '试卷题目不存在')
      return (res as any).ok(null, '移除成功')
    } catch (e: any) {
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
      if (!Array.isArray(orders) || orders.length === 0)
        return (res as any).badRequest('无效的题目顺序数据', { code: CODES.VALIDATION_ERROR })
      await svc.updateOrder(Number(req.params.id), orders)
      return (res as any).ok(null, '更新题目顺序成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '更新试卷题目顺序失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<PaperListData>>) {
    try {
      const difficulty = req.query.difficulty as any
      const limit = Number(req.query.limit ?? 10)
      const offset = Number(req.query.offset ?? 0)
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

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      await svc.remove(Number(req.params.id))
      return (res as any).ok(null, '删除试卷成功')
    } catch (e: any) {
      const notFound = /不存在/.test(e?.message)
      if (notFound) return (res as any).fail(CODES.NOT_FOUND, 404, e?.message || '试卷不存在')
      return (res as any).internal(e?.message || '删除试卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async smartGenerate(_req: AuthRequest, res: Response) {
    return (res as any).fail(CODES.NOT_IMPLEMENTED, 501, 'smartGenerate 尚未搬运（见服务实现 TODO）')
  }

  static async createWithQuestions(req: AuthRequest, res: Response) {
    try {
      const data = await svc.createWithQuestions(req.body)
      return (res as any).ok(data, '创建试卷成功')
    } catch (e: any) {
      return (res as any).internal(e?.message || '创建试卷失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
