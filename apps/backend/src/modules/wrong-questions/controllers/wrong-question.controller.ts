import type { Request, Response } from 'express'
import { WrongQuestionService } from '../services/wrong-question.service.js'

const svc = new WrongQuestionService()
const masteryWhitelist = ['not_mastered', 'partially_mastered', 'mastered'] as const
const asMastery = (s: any) =>
  typeof s === 'string' && (masteryWhitelist as readonly string[]).includes(s) ? (s as any) : null

export class WrongQuestionController {
  static async createBook(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const { name, description, is_public = false } = req.body
    if (!name || String(name).trim().length === 0) return res.status(400).json({ error: '错题本名称不能为空' })
    if (String(name).length > 100) return res.status(400).json({ error: '错题本名称不能超过100个字符' })
    const id = await svc.createBook({
      user_id: userId,
      name: String(name).trim(),
      description: description?.trim?.() || '',
      is_default: false,
      is_public: !!is_public,
    })
    return res.status(201).json({ message: '错题本创建成功', book_id: id })
  }

  static async getBooks(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const rows = await svc.getUserBooks(userId)
    return res.json({ message: '获取错题本列表成功', books: rows })
  }

  static async updateBook(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的错题本ID' })
    const { name, description, is_public } = req.body
    const patch: any = {}
    if (name !== undefined) {
      if (!name || String(name).trim().length === 0) return res.status(400).json({ error: '错题本名称不能为空' })
      if (String(name).length > 100) return res.status(400).json({ error: '错题本名称不能超过100个字符' })
      patch.name = String(name).trim()
    }
    if (description !== undefined) patch.description = description?.trim?.() || ''
    if (is_public !== undefined) patch.is_public = !!is_public
    await svc.updateBook(id, userId, patch)
    return res.json({ message: '错题本更新成功' })
  }

  static async deleteBook(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的错题本ID' })
    await svc.deleteBook(id, userId)
    return res.json({ message: '错题本删除成功' })
  }

  static async addWrongQuestion(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const { book_id, question_id, exam_result_id, tags, notes } = req.body
    if (!book_id || !question_id) return res.status(400).json({ error: '错题本ID和题目ID不能为空' })
    const id = await svc.addWrongQuestion({
      book_id: Number(book_id),
      question_id: Number(question_id),
      exam_result_id: exam_result_id ? Number(exam_result_id) : undefined,
      wrong_count: 1,
      last_wrong_time: new Date().toISOString(),
      mastery_level: 'not_mastered',
      tags: tags?.trim?.() || '',
      notes: notes?.trim?.() || '',
    })
    return res.status(201).json({ message: '错题添加成功', wrong_question_id: id })
  }

  static async getWrongQuestions(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const bookId = Number(req.params.bookId)
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: '无效的错题本ID' })
    const { page = '1', limit = '20', mastery_level, tags, search } = req.query
    const r = await svc.getWrongQuestions(bookId, userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      mastery_level: mastery_level as string | undefined,
      tags: tags as string | undefined,
      search: search as string | undefined,
    })
    return res.json({ message: '获取错题列表成功', ...r, page: Number(page) || 1, limit: Number(limit) || 20 })
  }

  static async updateWrongQuestion(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的错题ID' })
    const { mastery_level, tags, notes } = req.body
    const patch: any = {}
    if (mastery_level !== undefined) {
      const m = asMastery(mastery_level)
      if (!m) return res.status(400).json({ error: '无效的掌握程度' })
      patch.mastery_level = m
    }
    if (tags !== undefined) patch.tags = tags?.trim?.() || ''
    if (notes !== undefined) patch.notes = notes?.trim?.() || ''
    await svc.updateWrongQuestion(id, userId, patch)
    return res.json({ message: '错题更新成功' })
  }

  static async removeWrongQuestion(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的错题ID' })
    await svc.removeWrongQuestion(id, userId)
    return res.json({ message: '错题移除成功' })
  }

  /** ✅ 兼容 question_id 或 wrong_question_id 的练习记录上报 */
  static async addPracticeRecord(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })

    let { wrong_question_id, question_id, is_correct, time_spent, answer } = req.body

    // 参数校验：允许二选一
    if (!wrong_question_id && !question_id) {
      return res.status(400).json({ error: '缺少必要参数：question_id 或 wrong_question_id' })
    }
    if (is_correct === undefined) {
      return res.status(400).json({ error: '缺少必要参数：is_correct' })
    }

    // 若未传 wrong_question_id，则根据 question_id 自动确保错题条目存在（默认错题本）
    if (!wrong_question_id && question_id) {
      // 找默认错题本或创建
      const books = await svc.getUserBooks(userId)
      let defaultBook = (books as any[]).find(b => b.is_default)
      if (!defaultBook) {
        const id = await svc.createBook({
          user_id: userId,
          name: '我的错题本',
          description: '系统自动创建的默认错题本',
          is_default: true,
          is_public: false,
        })
        defaultBook = { id }
      }
      // 新建错题条目（若你的 Service 有“查找已存在”的方法，可替换以避免重复）
      const wid = await svc.addWrongQuestion({
        book_id: Number(defaultBook.id),
        question_id: Number(question_id),
        wrong_count: 1,
        last_wrong_time: new Date().toISOString(),
        mastery_level: 'not_mastered',
        tags: '',
        notes: '',
      })
      wrong_question_id = wid
    }

    const recordId = await svc.addPracticeRecord({
      user_id: userId,
      wrong_question_id: Number(wrong_question_id),
      is_correct: !!is_correct,
      time_spent: Number(time_spent ?? 0),
      practice_time: new Date().toISOString(),
      // 允许透传答案（如果你的 service 支持）
      answer,
    } as any)

    return res.status(201).json({ message: '练习记录添加成功', record_id: recordId })
  }

  /** ✅ 新增：返回当前用户“已练习过的题目ID”列表，用于前端过滤 */
  static async getPracticedQuestions(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const limit = Number(req.query.limit ?? 1000)

    try {
      // 优先使用 service 提供的专用方法（如果有）
      const rows =
        (await (svc as any).getPracticedQuestionIds?.(userId, limit)) ??
        (await (svc as any).getPracticeRecords?.(userId, { limit })) ??
        []

      // 尽最大努力从返回结构里提取 question_id
      const ids = Array.isArray(rows)
        ? rows.map((r: any) => Number(r?.question_id ?? r?.qid ?? r?.id)).filter((n: any) => Number.isFinite(n))
        : []

      return res.json({ message: '获取已练习题目成功', ids })
    } catch {
      // 即使没有实现对应 service，也不给 400/500，返回空集合以兼容前端逻辑
      return res.json({ message: '获取已练习题目成功', ids: [] })
    }
  }

  static async shareBook(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: '无效的错题本ID' })
    const { shared_to, is_public = false, expires_at } = req.body
    const code = await svc.shareBook(id, userId, {
      shared_to: shared_to ? Number(shared_to) : undefined,
      is_public: !!is_public,
      expires_at,
    })
    return res.status(201).json({ message: '错题本分享成功', share_code: code })
  }

  static async getSharedBook(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const { shareCode } = req.params
    if (!shareCode) return res.status(400).json({ error: '分享码不能为空' })
    const r = await svc.getSharedBook(shareCode, userId)
    if (!r) return res.status(404).json({ error: '分享链接无效或已过期' })
    return res.json({ message: '获取分享错题本成功', shared_book: r })
  }

  static async getStatistics(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: '未授权访问' })
    const s = await svc.getStatistics(userId)
    return res.json({ message: '获取统计信息成功', statistics: s })
  }

  static async batchAddWrongQuestions(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ message: '未授权访问' })
    const { book_id, questions } = req.body
    if (!book_id || !Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ message: '参数错误' })
    }
    const r = await svc.batchAddWrongQuestions(
      Number(book_id),
      questions.map((q: any) => Number(q.question_id)),
      undefined
    )
    return res.json({ message: '批量添加完成', results: r })
  }

  static async batchUpdateMastery(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ message: '未授权访问' })
    const { updates } = req.body
    if (!Array.isArray(updates) || !updates.length) return res.status(400).json({ message: '参数错误' })
    const results: Array<{ question_id: number; success: boolean; error?: string }> = []
    for (const u of updates) {
      try {
        const m = asMastery(u.mastery_level)
        if (!m) throw new Error('无效的掌握程度')
        await svc.updateWrongQuestion(Number(u.question_id), userId, { mastery_level: m })
        results.push({ question_id: Number(u.question_id), success: true })
      } catch (e: any) {
        results.push({ question_id: Number(u.question_id), success: false, error: e?.message })
      }
    }
    return res.json({ message: '批量更新完成', results })
  }

  static async autoCollectWrongQuestions(req: Request, res: Response) {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ message: '未授权访问' })
    const { exam_result_id } = req.body
    if (!exam_result_id) return res.status(400).json({ message: '考试结果ID不能为空' })

    const books = await svc.getUserBooks(userId)
    let defaultBook = (books as any[]).find(b => b.is_default)
    if (!defaultBook) {
      const id = await svc.createBook({
        user_id: userId,
        name: '我的错题本',
        description: '系统自动创建的默认错题本',
        is_default: true,
        is_public: false,
      })
      defaultBook = { id }
    }

    const wrongs = await svc.getWrongQuestionsFromExamResult(Number(exam_result_id))
    const results: Array<{ question_id: number; wrong_question_id?: number; success: boolean; error?: string }> = []
    for (const q of wrongs as any[]) {
      try {
        const wid = await svc.addWrongQuestion({
          book_id: Number(defaultBook.id),
          question_id: Number(q.question_id),
          exam_result_id: Number(exam_result_id),
          wrong_count: 1,
          last_wrong_time: new Date().toISOString(),
          mastery_level: 'not_mastered',
          tags: q.subject || '',
          notes: `来自考试：${q.exam_title || ''}`,
        })
        results.push({ question_id: Number(q.question_id), wrong_question_id: wid, success: true })
      } catch (e: any) {
        results.push({ question_id: Number(q.question_id), success: false, error: e?.message })
      }
    }
    return res.json({
      message: '自动收集错题完成',
      collected_count: results.filter(r => r.success).length,
      total_count: wrongs.length,
      results,
    })
  }
}
export default WrongQuestionController
