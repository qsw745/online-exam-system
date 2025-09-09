import type { Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import type { ApiResponse } from 'types/response.js'
import type { ExamListData, ExamDetailData, IExam } from '../domain/exam.model.js'
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
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取考试列表失败' })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<ExamDetailData>>) {
    try {
      const examId = Number(req.params.id)
      if (Number.isNaN(examId)) return res.status(400).json({ success: false, error: '无效的考试ID' })
      const data = await svc.getById(examId)
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '获取考试详情失败' })
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<IExam>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const exam = await svc.create(userId, req.body)
      return res.status(201).json({ success: true, data: exam })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '创建考试失败' })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<IExam>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(examId)) return res.status(400).json({ success: false, error: '无效的考试ID' })
      const exam = await svc.update(userId, examId, req.body)
      return res.json({ success: true, data: exam })
    } catch (e: any) {
      const code = /不存在|权限/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '更新考试失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(examId)) return res.status(400).json({ success: false, error: '无效的考试ID' })
      await svc.remove(userId, examId)
      return res.json({ success: true, data: null })
    } catch (e: any) {
      const code = /不存在|权限/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '删除考试失败' })
    }
  }

  static async start(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      await svc.start(userId, examId)
      return res.json({ success: true, data: null })
    } catch (e: any) {
      const code = /不存在|发布|开始|结束|已经开始/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '开始考试失败' })
    }
  }

  static async submit(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const examId = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      await svc.submit(userId, examId, req.body?.answers || {}, req)
      return res.json({ success: true, data: null })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '提交考试失败' })
    }
  }
}
