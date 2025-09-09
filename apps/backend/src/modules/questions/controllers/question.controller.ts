// apps/backend/src/modules/questions/controllers/question.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from 'types/auth'
import type { ApiResponse } from 'types/response'
import type { QuestionData, QuestionListData } from '../domain/question.model'
import { QuestionService } from '../services/question.service'

const svc = new QuestionService()

export class QuestionController {
  static async list(req: AuthRequest, res: Response<ApiResponse<QuestionListData>>) {
    try {
      const question_type = req.query.type as any
      const difficulty = req.query.difficulty as any
      const search = req.query.search as string | undefined
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const tagsParam = req.query.tags
      const tags = Array.isArray(tagsParam)
        ? (tagsParam as string[])
        : typeof tagsParam === 'string'
        ? tagsParam
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []
      const data = await svc.list({ question_type, difficulty, search, tags, page, limit })
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取问题列表失败' })
    }
  }

  static async getById(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的题目ID' })
      const data = await svc.getById(id)
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '获取问题详情失败' })
    }
  }

  static async create(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const data = await svc.create({ id: req.user?.id, username: req.user?.username }, req.body, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.status(201).json({ success: true, data })
    } catch (e: any) {
      const code = /无效|缺少|选择题/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '创建问题失败' })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的题目ID' })
      const data = await svc.update({ id: req.user?.id, username: req.user?.username }, id, req.body, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data })
    } catch (e: any) {
      const code = /不存在|没有需要更新/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '更新问题失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的题目ID' })
      await svc.remove({ id: req.user?.id, username: req.user?.username }, id, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.json({ success: true, data: null })
    } catch (e: any) {
      const code = /不存在/.test(e?.message) ? 404 : 500
      return res.status(code).json({ success: false, error: e?.message || '删除问题失败' })
    }
  }

  static async bulkImport(
    req: AuthRequest,
    res: Response<ApiResponse<{ success_count: number; fail_count: number; errors: string[] }>>
  ) {
    try {
      const data = await svc.bulkImport({ id: req.user?.id, username: req.user?.username }, req.body, req.query, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.status(200).json({ success: true, data })
    } catch (e: any) {
      const code = /有效|超过/.test(e?.message) ? 400 : 500
      return res.status(code).json({ success: false, error: e?.message || '批量导入失败' })
    }
  }

  // practice & wrong-questions
  static async recordPractice(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })
      const { question_id, is_correct, answer } = req.body
      if (!question_id || is_correct === undefined)
        return res.status(400).json({ success: false, error: '缺少必要参数' })
      await svc.recordPractice(userId, { question_id, is_correct, answer })
      return res.json({ success: true, data: null })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '记录练习结果失败' })
    }
  }

  static async getWrongQuestions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问或用户ID无效' })
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const mastered = req.query.mastered === 'true' ? true : req.query.mastered === 'false' ? false : undefined
      const data = await svc.listWrong(userId, page, limit, mastered)
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e?.message || '获取错题本失败' })
    }
  }

  static async markAsMastered(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = Number(req.params.questionId)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (!Number.isFinite(questionId)) return res.status(400).json({ success: false, error: '无效的题目ID' })
      await svc.markAsMastered(userId, questionId)
      return res.json({ success: true, data: null })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '标记掌握失败' })
    }
  }

  static async removeFromWrongQuestions(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = Number(req.params.questionId)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (!Number.isFinite(questionId)) return res.status(400).json({ success: false, error: '无效的题目ID' })
      await svc.removeFromWrong(userId, questionId)
      return res.json({ success: true, data: null })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '移除错题失败' })
    }
  }

  static async getPracticeStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const data = await svc.stats(userId)
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e?.message || '获取练习统计失败' })
    }
  }

  static async getPracticedQuestions(req: AuthRequest, res: Response<ApiResponse<number[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const ids = await svc.practicedIds(userId)
      return res.json({ success: true, data: ids })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取已练习题目列表失败' })
    }
  }

  static async getTags(_req: AuthRequest, res: Response) {
    try {
      const tags = await svc.tags()
      return res.json({ success: true, data: tags })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取标签列表失败' })
    }
  }

  static async getKnowledgePoints(_req: AuthRequest, res: Response) {
    try {
      const data = await svc.knowledgePoints()
      return res.json({ success: true, data })
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || '获取知识点列表失败' })
    }
  }
}
