import type { Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import type { ApiResponse } from 'types/response.js'
import type { PaperData, PaperListData, PaperQuestionData } from '../domain/paper.model'
import { PaperService } from '../services/paper.service'

const svc = new PaperService()

export class PaperController {
  static async addQuestion(req: AuthRequest, res: Response<ApiResponse<{ questionId: number }>>) {
    try {
      const paperId = Number(req.params.id)
      const data = await svc.addQuestion(paperId, req.body)
      return res.status(201).json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '添加试卷题目失败' })
    }
  }

  static async removeQuestion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const affected = await svc.removeQuestion(Number(req.params.id), Number(req.params.questionId))
      if (!affected) return res.status(404).json({ success: false, error: '试卷题目不存在' })
      return res.json({ success: true, data: null })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '移除试卷题目失败' })
    }
  }

  static async getQuestions(req: AuthRequest, res: Response<ApiResponse<PaperQuestionData>>) {
    try {
      const data = await svc.getQuestions(Number(req.params.id))
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取试卷题目列表失败' })
    }
  }

  static async updateQuestionOrder(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const orders = req.body?.orders
      if (!Array.isArray(orders) || orders.length === 0)
        return res.status(400).json({ success: false, error: '无效的题目顺序数据' })
      await svc.updateOrder(Number(req.params.id), orders)
      return res.json({ success: true, data: null })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '更新试卷题目顺序失败' })
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<PaperListData>>) {
    try {
      const difficulty = req.query.difficulty as any
      const limit = Number(req.query.limit ?? 10)
      const offset = Number(req.query.offset ?? 0)
      const data = await svc.list({ difficulty, limit, offset })
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取试卷列表失败' })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const data = await svc.getById(Number(req.params.id))
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '获取试卷详情失败' })
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const data = await svc.create(req.body)
      return res.status(201).json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '创建试卷失败' })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<PaperData>>) {
    try {
      const data = await svc.update(Number(req.params.id), req.body)
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '更新试卷失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      await svc.remove(Number(req.params.id))
      return res.json({ success: true, data: null })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '删除试卷失败' })
    }
  }

  static async smartGenerate(req: AuthRequest, res: Response) {
    // 如果你需要这块，按注释把 service.smartGenerate 填完后直接转调即可
    return res.status(501).json({ success: false, error: 'smartGenerate 尚未搬运（见服务实现 TODO）' })
  }

  static async createWithQuestions(req: AuthRequest, res: Response) {
    try {
      const data = await svc.createWithQuestions(req.body)
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '创建试卷失败' })
    }
  }
}
