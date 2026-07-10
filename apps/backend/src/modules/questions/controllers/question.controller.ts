/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import type { QuestionData } from '../domain/question.model'
import { QuestionService } from '../services/question.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string, extra?: any): Res<T>
  created<D = any>(data?: D, message?: string, extra?: any): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  unauthorized(message?: string, extra?: any): Res<T>
  forbidden(message?: string, extra?: any): Res<T>
  notFound(message?: string, extra?: any): Res<T>
  tooMany(message?: string, extra?: any): Res<T>
  conflict(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
  fail(code: string, httpStatus?: number, message?: string, extra?: any): Res<T>
}
const svc = new QuestionService()
// ===== 字面量联合，与 service 的签名保持一致 =====
type QType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
type QDiff = 'easy' | 'medium' | 'hard'

// --------- 工具：把 string / array / CSV 严格收敛为联合类型 ----------
const TYPE_SET = new Set<QType>(['single_choice', 'multiple_choice', 'true_false', 'short_answer'])
const DIFF_SET = new Set<QDiff>(['easy', 'medium', 'hard'])

function isAllowedType(x: any): x is QType {
  return typeof x === 'string' && TYPE_SET.has(x as QType)
}
function isAllowedDifficulty(x: any): x is QDiff {
  return typeof x === 'string' && DIFF_SET.has(x as QDiff)
}
/** 将 string | string[] | CSV | 其它，统一转为 string[] */
function toStrArray(maybe: any): string[] {
  if (Array.isArray(maybe))
    return maybe
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
  if (typeof maybe === 'string') {
    return maybe
      .trim()
      .replace(/[\r\n]+/g, ',')
      .replace(/[，；;]/g, ',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (maybe != null && (typeof maybe === 'number' || typeof maybe === 'boolean')) return [String(maybe)]
  return []
}
/** 单值收敛为 QType | undefined */
function narrowType(raw: any): QType | undefined {
  return isAllowedType(raw) ? (raw as QType) : undefined
}
/** 多值收敛为 QType[]（会去重 + 过滤非法值） */
function narrowTypes(...inputs: any[]): QType[] {
  const all = inputs.flatMap(toStrArray)
  const arr = all.filter(isAllowedType) as QType[]
  return Array.from(new Set(arr))
}
/** 难度收敛 */
function narrowDifficulty(raw: any): QDiff | undefined {
  return isAllowedDifficulty(raw) ? (raw as QDiff) : undefined
}
export class QuestionController {
  /** 批量获取题目详情（ids: number[]） */
  static async getBatchByIds(req: AuthRequest, res: Res<ApiResponse<any[]>>) {
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

  /** 列表查询（带筛选/分页/查重） */
  static async list(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      // ✅ 兼容：type（单值）、types[]（多值数组）、types_csv（逗号串）
      const typeSingleNarrow = narrowType((req.query.type as string | undefined) || undefined)
      const question_types = narrowTypes((req.query as any).types, (req.query as any).types_csv, typeSingleNarrow)

      const difficulty = narrowDifficulty(req.query.difficulty as any)
      const search = (req.query.search || req.query.keyword) as string | undefined
      const page = req.query.page ? parseInt(req.query.page as string) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10

      const tagsParam = req.query.tags
      const tags = Array.isArray(tagsParam)
        ? (tagsParam as string[]).map(s => s.trim()).filter(Boolean)
        : typeof tagsParam === 'string'
        ? tagsParam
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []

      // 重复开关（兼容多种写法）
      const dup = String(req.query.duplicates || '').toLowerCase()
      const grouped =
        String(req.query.grouped || '').toLowerCase() === 'true' || dup.includes('group') || dup === 'grouped'

      if (dup === 'title_type' || dup === 'title+type' || dup === 'true' || grouped) {
        // 查重接口沿用单题型筛选（如需多选，再改 repository 中 SQL）
        const data = grouped
          ? await svc.listDuplicatesGrouped({
              question_type: typeSingleNarrow, // <-- 已收敛为联合类型或 undefined
              search,
              page,
              limit,
            })
          : await svc.listDuplicates({
              question_type: typeSingleNarrow,
              search,
              page,
              limit,
            })
        return res.ok(data, '获取成功')
      }

      // ✅ 普通列表（支持多题型，严格类型）
      const data = await svc.list({
        question_types, // QType[]
        difficulty, // QDiff | undefined
        search,
        tags,
        page,
        limit,
      })
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取问题列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 获取单题详情 */
  static async getById(req: AuthRequest, res: Res<ApiResponse<QuestionData>>) {
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
  static async create(req: AuthRequest, res: Res<ApiResponse<QuestionData>>) {
    try {
      const data = await svc.create({ id: req.user?.id, email: req.user?.email }, req.body, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.created(data, '创建成功')
    } catch (e: any) {
      if (/无效|缺少|选择题|题目质量|题干/.test(e?.message)) return res.badRequest(e?.message || '参数校验失败')
      return res.internal(e?.message || '创建问题失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 更新题目 */
  static async update(req: AuthRequest, res: Res<ApiResponse<QuestionData>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的题目ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.update({ id: req.user?.id, email: req.user?.email }, id, req.body, {
        ip: req.ip,
        ua: req.get('User-Agent') || undefined,
      })
      return res.ok(data, '更新成功')
    } catch (e: any) {
      if (/不存在|没有需要更新|题目质量|题干/.test(e?.message)) {
        return res.fail(CODES.VALIDATION_ERROR, 400, e?.message || '不可更新')
      }
      return res.internal(e?.message || '更新问题失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  /** 删除题目 */
  static async delete(req: AuthRequest, res: Res<ApiResponse<null>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的题目ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove({ id: req.user?.id, email: req.user?.email }, id, {
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
    res: Res<ApiResponse<{ success_count: number; fail_count: number; errors: string[] }>>
  ) {
    const rid = (req as any).id || req.header('x-request-id') || undefined
    try {
      const data = await svc.bulkImport({ id: req.user?.id, email: req.user?.email }, req.body, req.query, {
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
  static async recordPractice(req: AuthRequest, res: Res<ApiResponse<null>>) {
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

  static async getWrongQuestions(req: AuthRequest, res: Res<ApiResponse<any>>) {
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

  static async markAsMastered(req: AuthRequest, res: Res<ApiResponse<null>>) {
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

  static async removeFromWrongQuestions(req: AuthRequest, res: Res<ApiResponse<null>>) {
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

  static async getPracticeStats(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const data = await svc.stats(userId)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.badRequest(e?.message || '获取练习统计失败')
    }
  }

  static async getPracticedQuestions(req: AuthRequest, res: Res<ApiResponse<number[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const ids = await svc.practicedIds(userId)
      return res.ok(ids, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取已练习题目列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getTags(_req: AuthRequest, res: Res<ApiResponse<string[]>>) {
    try {
      const tags = await svc.tags()
      return res.ok(tags, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取标签列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getKnowledgePoints(_req: AuthRequest, res: Res<ApiResponse<any[]>>) {
    try {
      const data = await svc.knowledgePoints()
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取知识点列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
