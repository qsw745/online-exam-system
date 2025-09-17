// src/features/questions/controllers/question.controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { QuestionData, QuestionListData } from '../domain/question.model'
import { QuestionService } from '../services/question.service'

const svc = new QuestionService()

export class QuestionController {
  /** 批量获取题目详情（ids: number[]） */
  static async getBatchByIds(req: AuthRequest, res: Response<ApiResponse<any[]>>) {
    try {
      const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : []
      const ids = idsRaw.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n))
      if (!ids.length) return res.badRequest('请提供有效的题目ID数组', { code: CODES.VALIDATION_ERROR })
      const data = await svc.batch(ids)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '批量获取题目失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 列表查询（带筛选/分页） */
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
              ? tagsParam.split(',').map(s => s.trim()).filter(Boolean)
              : []

      const data = await svc.list({ question_type, difficulty, search, tags, page, limit })
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取问题列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 获取单题详情 */
  static async getById(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的题目ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.getById(id)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      if (/不存在/.test(e?.message)) return res.fail(CODES.VALIDATION_ERROR, 404, '题目不存在')
      return res.internal(e?.message || '获取问题详情失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 创建题目 */
  static async create(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const data = await svc.create({ id: req.user?.id, username: req.user?.username }, req.body, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.created(data, '创建成功')
    } catch (e: any) {
      if (/无效|缺少|选择题/.test(e?.message)) return res.badRequest(e?.message || '参数校验失败')
      return res.internal(e?.message || '创建问题失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 更新题目 */
  static async update(req: AuthRequest, res: Response<ApiResponse<QuestionData>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的题目ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.update({ id: req.user?.id, username: req.user?.username }, id, req.body, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.ok(data, '更新成功')
    } catch (e: any) {
      if (/不存在|没有需要更新/.test(e?.message)) {
        return res.fail(CODES.VALIDATION_ERROR, 400, e?.message || '不可更新')
      }
      return res.internal(e?.message || '更新问题失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 删除题目 */
  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的题目ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove({ id: req.user?.id, username: req.user?.username }, id, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.ok(null, '删除成功')
    } catch (e: any) {
      if (/不存在/.test(e?.message)) return res.fail(CODES.VALIDATION_ERROR, 404, '题目不存在')
      return res.internal(e?.message || '删除问题失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 批量导入 */
  static async bulkImport(
      req: AuthRequest,
      res: Response<ApiResponse<{ success_count: number; fail_count: number; errors: string[] }>>
  ) {
    const rid = (req as any).id || req.header('x-request-id') || undefined
    try {
      const data = await svc.bulkImport({ id: req.user?.id, username: req.user?.username }, req.body, req.query, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
        rid,
      })
      return res.ok(data, '导入完成', { meta: { rid } })
    } catch (e: any) {
      if (/有效|超过/.test(e?.message)) {
        return res.badRequest(e?.message || '参数错误', { meta: { rid } })
      }
      return res.internal(e?.message || '批量导入失败', { code: CODES.INTERNAL_ERROR, meta: { rid } })
    }
  }

  // ===== 练习 / 错题本 =====

  /** 记录练习结果 */
  static async recordPractice(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问或用户ID无效')
      const { question_id, is_correct, answer } = req.body || {}
      if (!question_id || is_correct === undefined) return res.badRequest('缺少必要参数')
      await svc.recordPractice(userId, { question_id, is_correct, answer })
      return res.ok(null, '已记录')
    } catch (e: any) {
      return res.internal(e?.message || '记录练习结果失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 获取错题本 */
  static async getWrongQuestions(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问或用户ID无效')
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const mastered = req.query.mastered === 'true' ? true : req.query.mastered === 'false' ? false : undefined
      const data = await svc.listWrong(userId, page, limit, mastered)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.badRequest(e?.message || '获取错题本失败')
    }
  }

  /** 标记已掌握 */
  static async markAsMastered(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = Number(req.params.questionId)
      if (!userId) return res.unauthorized('未授权访问')
      if (!Number.isFinite(questionId)) return res.badRequest('无效的题目ID')
      await svc.markAsMastered(userId, questionId)
      return res.ok(null, '已标记')
    } catch (e: any) {
      return res.internal(e?.message || '标记掌握失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 从错题本移除 */
  static async removeFromWrongQuestions(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const questionId = Number(req.params.questionId)
      if (!userId) return res.unauthorized('未授权访问')
      if (!Number.isFinite(questionId)) return res.badRequest('无效的题目ID')
      await svc.removeFromWrong(userId, questionId)
      return res.ok(null, '已移除')
    } catch (e: any) {
      return res.internal(e?.message || '移除错题失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 练习统计 */
  static async getPracticeStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const data = await svc.stats(userId)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.badRequest(e?.message || '获取练习统计失败')
    }
  }

  /** 已练习题目ID列表 */
  static async getPracticedQuestions(req: AuthRequest, res: Response<ApiResponse<number[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const ids = await svc.practicedIds(userId)
      return res.ok(ids, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取已练习题目列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 标签列表 */
  static async getTags(_req: AuthRequest, res: Response<ApiResponse<string[]>>) {
    try {
      const tags = await svc.tags()
      return res.ok(tags, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取标签列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 知识点列表 */
  static async getKnowledgePoints(_req: AuthRequest, res: Response<ApiResponse<any[]>>) {
    try {
      const data = await svc.knowledgePoints()
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取知识点列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
