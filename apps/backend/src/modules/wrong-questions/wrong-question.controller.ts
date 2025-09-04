// apps/backend/src/modules/wrong-questions/wrong-question.controller.ts
import type { Request, Response } from 'express'
import {
  WrongQuestionService,
  type IPracticeRecord,
  type IWrongQuestion,
  type IWrongQuestionBook,
} from './wrong-question.service.js'

// ---- 日志：做一个安全薄封装，避免签名不一致导致 TS 报错 ----
import { LoggerService as Logger } from '@infrastructure/logging/logger.js'
const safeLogSystem = (level: 'info' | 'warn' | 'error', message: string, meta?: any) => {
  try {
    const fn = (Logger as any).logSystemLog ?? (Logger as any).logSystem ?? (Logger as any).system
    if (typeof fn === 'function') fn(level, message, meta)
    else console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](message, meta || '')
  } catch {}
}
const safeLogUserAction = (...args: any[]) => {
  try {
    const fn = (Logger as any).logUserAction ?? (Logger as any).userAction
    if (typeof fn === 'function') fn(...args)
  } catch {}
}

// ---- 帮助函数 ----
const masteryWhitelist = ['not_mastered', 'partially_mastered', 'mastered'] as const
type Mastery = (typeof masteryWhitelist)[number]
const asMastery = (s: any): Mastery | null =>
  typeof s === 'string' && (masteryWhitelist as readonly string[]).includes(s) ? (s as Mastery) : null

export class WrongQuestionController {
  // 创建错题本
  static async createBook(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const { name, description, is_public = false } = req.body
      if (!name || String(name).trim().length === 0) return res.status(400).json({ error: '错题本名称不能为空' })
      if (String(name).length > 100) return res.status(400).json({ error: '错题本名称不能超过100个字符' })

      const bookData: Omit<IWrongQuestionBook, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        name: String(name).trim(),
        description: description?.trim?.() || '',
        is_default: false,
        is_public: !!is_public,
      }

      const bookId = await WrongQuestionService.createBook(bookData)
      return res.status(201).json({ message: '错题本创建成功', book_id: bookId })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to create wrong question book', {
        error: error?.message,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: '创建错题本失败' })
    }
  }

  // 获取错题本列表
  static async getBooks(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const books = await WrongQuestionService.getUserBooks(userId)
      return res.json({ message: '获取错题本列表成功', books })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get wrong question books', {
        error: error?.message,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: '获取错题本列表失败' })
    }
  }

  // 更新错题本
  static async updateBook(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const bookId = Number(req.params.id)
      if (!Number.isFinite(bookId)) return res.status(400).json({ error: '无效的错题本ID' })

      const { name, description, is_public } = req.body
      const updates: Partial<IWrongQuestionBook> = {}

      if (name !== undefined) {
        if (!name || String(name).trim().length === 0) return res.status(400).json({ error: '错题本名称不能为空' })
        if (String(name).length > 100) return res.status(400).json({ error: '错题本名称不能超过100个字符' })
        updates.name = String(name).trim()
      }
      if (description !== undefined) updates.description = description?.trim?.() || ''
      if (is_public !== undefined) updates.is_public = !!is_public

      await WrongQuestionService.updateBook(bookId, userId, updates)
      return res.json({ message: '错题本更新成功' })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to update wrong question book', {
        error: error?.message,
        book_id: req.params.id,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '更新错题本失败' })
    }
  }

  // 删除错题本
  static async deleteBook(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const bookId = Number(req.params.id)
      if (!Number.isFinite(bookId)) return res.status(400).json({ error: '无效的错题本ID' })

      await WrongQuestionService.deleteBook(bookId, userId)
      return res.json({ message: '错题本删除成功' })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to delete wrong question book', {
        error: error?.message,
        book_id: req.params.id,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '删除错题本失败' })
    }
  }

  // 添加错题
  static async addWrongQuestion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const { book_id, question_id, exam_result_id, tags, notes } = req.body
      if (!book_id || !question_id) return res.status(400).json({ error: '错题本ID和题目ID不能为空' })

      const questionData: Omit<IWrongQuestion, 'id' | 'created_at' | 'updated_at'> = {
        book_id: Number(book_id),
        question_id: Number(question_id),
        exam_result_id: exam_result_id ? Number(exam_result_id) : undefined,
        wrong_count: 1,
        last_wrong_time: new Date().toISOString(),
        mastery_level: 'not_mastered',
        tags: tags?.trim?.() || '',
        notes: notes?.trim?.() || '',
      }

      const wrongQuestionId = await WrongQuestionService.addWrongQuestion(questionData)
      return res.status(201).json({ message: '错题添加成功', wrong_question_id: wrongQuestionId })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to add wrong question', { error: error?.message, user_id: (req as any).user?.id })
      return res.status(500).json({ error: '添加错题失败' })
    }
  }

  // 获取错题列表
  static async getWrongQuestions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const bookId = Number(req.params.bookId)
      if (!Number.isFinite(bookId)) return res.status(400).json({ error: '无效的错题本ID' })

      const { page = '1', limit = '20', mastery_level, tags, search } = req.query

      const options = {
        page: Number(page) || 1,
        limit: Math.min(Number(limit) || 20, 100),
        mastery_level: mastery_level as string | undefined,
        tags: tags as string | undefined,
        search: search as string | undefined,
      }

      const result = await WrongQuestionService.getWrongQuestions(bookId, userId, options)
      return res.json({ message: '获取错题列表成功', ...result, page: options.page, limit: options.limit })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get wrong questions', {
        error: error?.message,
        book_id: req.params.bookId,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '获取错题列表失败' })
    }
  }

  // 更新错题
  static async updateWrongQuestion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const questionId = Number(req.params.id)
      if (!Number.isFinite(questionId)) return res.status(400).json({ error: '无效的错题ID' })

      const { mastery_level, tags, notes } = req.body
      const updates: Partial<IWrongQuestion> = {}

      if (mastery_level !== undefined) {
        const m = asMastery(mastery_level)
        if (!m) return res.status(400).json({ error: '无效的掌握程度' })
        updates.mastery_level = m
      }
      if (tags !== undefined) updates.tags = tags?.trim?.() || ''
      if (notes !== undefined) updates.notes = notes?.trim?.() || ''

      await WrongQuestionService.updateWrongQuestion(questionId, userId, updates)
      return res.json({ message: '错题更新成功' })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to update wrong question', {
        error: error?.message,
        question_id: req.params.id,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '更新错题失败' })
    }
  }

  // 移除错题
  static async removeWrongQuestion(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const questionId = Number(req.params.id)
      if (!Number.isFinite(questionId)) return res.status(400).json({ error: '无效的错题ID' })

      await WrongQuestionService.removeWrongQuestion(questionId, userId)
      return res.json({ message: '错题移除成功' })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to remove wrong question', {
        error: error?.message,
        question_id: req.params.id,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '移除错题失败' })
    }
  }

  // 添加练习记录
  static async addPracticeRecord(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const { wrong_question_id, is_correct, time_spent } = req.body
      if (!wrong_question_id || is_correct === undefined || time_spent === undefined) {
        return res.status(400).json({ error: '缺少必要参数' })
      }

      const recordData: Omit<IPracticeRecord, 'id' | 'created_at'> = {
        user_id: userId,
        wrong_question_id: Number(wrong_question_id),
        is_correct: !!is_correct,
        time_spent: Number(time_spent),
        practice_time: new Date().toISOString(),
      }

      const recordId = await WrongQuestionService.addPracticeRecord(recordData)
      return res.status(201).json({ message: '练习记录添加成功', record_id: recordId })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to add practice record', { error: error?.message, user_id: (req as any).user?.id })
      return res.status(500).json({ error: '添加练习记录失败' })
    }
  }

  // 分享错题本
  static async shareBook(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const bookId = Number(req.params.id)
      if (!Number.isFinite(bookId)) return res.status(400).json({ error: '无效的错题本ID' })

      const { shared_to, is_public = false, expires_at } = req.body
      const shareCode = await WrongQuestionService.shareBook(bookId, userId, {
        shared_to: shared_to ? Number(shared_to) : undefined,
        is_public: !!is_public,
        expires_at: expires_at || undefined,
      })

      return res.status(201).json({ message: '错题本分享成功', share_code: shareCode })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to share wrong question book', {
        error: error?.message,
        book_id: req.params.id,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '分享错题本失败' })
    }
  }

  // 获取分享的错题本
  static async getSharedBook(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const { shareCode } = req.params
      if (!shareCode) return res.status(400).json({ error: '分享码不能为空' })

      const sharedBook = await WrongQuestionService.getSharedBook(shareCode, userId)
      return res.json({ message: '获取分享错题本成功', shared_book: sharedBook })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get shared wrong question book', {
        error: error?.message,
        share_code: req.params.shareCode,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: error?.message || '获取分享错题本失败' })
    }
  }

  // —— 新增：统计信息 —— //
  static async getStatistics(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ error: '未授权访问' })

      const statistics = await WrongQuestionService.getStatistics(userId)
      return res.json({ message: '获取统计信息成功', statistics })
    } catch (error: any) {
      safeLogSystem('error', 'Failed to get wrong question statistics', {
        error: error?.message,
        user_id: (req as any).user?.id,
      })
      return res.status(500).json({ error: '获取统计信息失败' })
    }
  }

  // 批量添加错题
  static async batchAddWrongQuestions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ message: '未授权访问' })

      const { book_id, questions } = req.body
      if (!book_id || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: '参数错误' })
      }

      const results: Array<{ question_id: number; wrong_question_id?: number; success: boolean; error?: string }> = []
      for (const q of questions) {
        try {
          const wrongQuestionId = await WrongQuestionService.addWrongQuestion({
            book_id: Number(book_id),
            question_id: Number(q.question_id),
            exam_result_id: q.exam_result_id ? Number(q.exam_result_id) : undefined,
            wrong_count: q.wrong_count || 1,
            last_wrong_time: q.last_wrong_time || new Date().toISOString(),
            mastery_level: asMastery(q.mastery_level) || 'not_mastered',
            tags: q.tags,
            notes: q.notes,
          })
          results.push({ question_id: Number(q.question_id), wrong_question_id: wrongQuestionId, success: true })
        } catch (e: any) {
          results.push({ question_id: Number(q.question_id), success: false, error: e?.message })
        }
      }

      return res.json({ message: '批量添加完成', results })
    } catch (error: any) {
      return res.status(500).json({ message: '批量添加错题失败', error: error?.message })
    }
  }

  // 批量更新掌握程度
  static async batchUpdateMastery(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ message: '未授权访问' })

      const { updates } = req.body
      if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ message: '参数错误' })

      const results: Array<{ question_id: number; success: boolean; error?: string }> = []
      for (const u of updates) {
        try {
          const m = asMastery(u.mastery_level)
          if (!m) throw new Error('无效的掌握程度')
          await WrongQuestionService.updateWrongQuestion(Number(u.question_id), userId, { mastery_level: m })
          results.push({ question_id: Number(u.question_id), success: true })
        } catch (e: any) {
          results.push({ question_id: Number(u.question_id), success: false, error: e?.message })
        }
      }

      return res.json({ message: '批量更新完成', results })
    } catch (error: any) {
      return res.status(500).json({ message: '批量更新掌握程度失败', error: error?.message })
    }
  }

  // 自动收集错题
  static async autoCollectWrongQuestions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as number | undefined
      if (!userId) return res.status(401).json({ message: '未授权访问' })

      const { exam_result_id } = req.body
      if (!exam_result_id) return res.status(400).json({ message: '考试结果ID不能为空' })

      // 获取/创建默认错题本
      const books = await WrongQuestionService.getUserBooks(userId)
      let defaultBook = books.find((b: any) => b.is_default)
      if (!defaultBook) {
        const bookId = await WrongQuestionService.createBook({
          user_id: userId,
          name: '我的错题本',
          description: '系统自动创建的默认错题本',
          is_default: true,
          is_public: false,
        })
        defaultBook = { id: bookId }
      }

      // 拉取错题并写入
      const wrongQuestions = await WrongQuestionService.getWrongQuestionsFromExamResult(Number(exam_result_id))
      const results: Array<{ question_id: number; wrong_question_id?: number; success: boolean; error?: string }> = []

      for (const q of wrongQuestions) {
        try {
          const wrongQuestionId = await WrongQuestionService.addWrongQuestion({
            book_id: Number(defaultBook.id),
            question_id: Number(q.question_id),
            exam_result_id: Number(exam_result_id),
            wrong_count: 1,
            last_wrong_time: new Date().toISOString(),
            mastery_level: 'not_mastered',
            tags: q.subject || '',
            notes: `来自考试：${q.exam_title || ''}`,
          })
          results.push({ question_id: Number(q.question_id), wrong_question_id: wrongQuestionId, success: true })
        } catch (e: any) {
          results.push({ question_id: Number(q.question_id), success: false, error: e?.message })
        }
      }

      return res.json({
        message: '自动收集错题完成',
        collected_count: results.filter(r => r.success).length,
        total_count: wrongQuestions.length,
        results,
      })
    } catch (error: any) {
      return res.status(500).json({ message: '自动收集错题失败', error: error?.message })
    }
  }
}

export default WrongQuestionController
