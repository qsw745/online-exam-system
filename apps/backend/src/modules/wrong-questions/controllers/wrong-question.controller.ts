// apps/backend/src/modules/wrong-questions/controllers/wrong-question.controller.ts
import type { Request, Response } from 'express'
import { WrongQuestionService } from '../services/wrong-question.service.js'
import { CODES } from '@/types/response'
import { log } from '@/infrastructure/logging/logger'

const svc = new WrongQuestionService()
const masteryWhitelist = ['not_mastered', 'partially_mastered', 'mastered'] as const
const asMastery = (s: any) =>
    typeof s === 'string' && (masteryWhitelist as readonly string[]).includes(s) ? (s as any) : null

export class WrongQuestionController {
    // ---- books ----
    static async createBook(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()

            const { name, description, is_public = false } = req.body
            if (!name || String(name).trim().length === 0) return res.badRequest('错题本名称不能为空')
            if (String(name).length > 100) return res.badRequest('错题本名称不能超过100个字符')

            const id = await svc.createBook({
                user_id: userId,
                name: String(name).trim(),
                description: description?.trim?.() || '',
                is_default: false,
                is_public: !!is_public,
            })
            return res.created({ book_id: id }, '错题本创建成功')
        } catch (e) {
            log.error('createBook error:', e)
            return res.internal('错题本创建失败')
        }
    }

    static async getBooks(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const rows = await svc.getUserBooks(userId)
            return res.ok({ books: rows }, '获取错题本列表成功')
        } catch (e) {
            log.error('getBooks error:', e)
            return res.internal('获取错题本列表失败')
        }
    }

    static async updateBook(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的错题本ID')

            const { name, description, is_public } = req.body
            const patch: any = {}
            if (name !== undefined) {
                if (!name || String(name).trim().length === 0) return res.badRequest('错题本名称不能为空')
                if (String(name).length > 100) return res.badRequest('错题本名称不能超过100个字符')
                patch.name = String(name).trim()
            }
            if (description !== undefined) patch.description = description?.trim?.() || ''
            if (is_public !== undefined) patch.is_public = !!is_public

            await svc.updateBook(id, userId, patch)
            return res.ok(null, '错题本更新成功')
        } catch (e) {
            log.error('updateBook error:', e)
            return res.internal('错题本更新失败')
        }
    }

    static async deleteBook(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的错题本ID')
            await svc.deleteBook(id, userId)
            return res.ok(null, '错题本删除成功')
        } catch (e) {
            log.error('deleteBook error:', e)
            return res.internal('错题本删除失败')
        }
    }

    // ---- questions ----
    static async addWrongQuestion(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const { book_id, question_id, exam_result_id, tags, notes } = req.body
            if (!book_id || !question_id) return res.badRequest('错题本ID和题目ID不能为空')

            const id = await svc.addWrongQuestion({
                user_id: Number(userId),             // ✅ 关键：带上 user_id
                book_id: Number(book_id),
                question_id: Number(question_id),
                exam_result_id: exam_result_id ? Number(exam_result_id) : undefined,
                wrong_count: 1,
                last_wrong_time: new Date(),
                mastery_level: 'not_mastered',
                tags: tags?.trim?.() || '',
                notes: notes?.trim?.() || '',
            })
            return res.created({ wrong_question_id: id }, '错题添加成功')
        } catch (e) {
            log.error('addWrongQuestion error:', e)
            return res.internal('错题添加失败')
        }
    }

    static async getWrongQuestions(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const bookId = Number(req.params.bookId)
            if (!Number.isFinite(bookId)) return res.badRequest('无效的错题本ID')
            const { page = '1', limit = '20', mastery_level, tags, search } = req.query

            const r = await svc.getWrongQuestions(bookId, userId, {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                mastery_level: mastery_level as string | undefined,
                tags: tags as string | undefined,
                search: search as string | undefined,
            })
            return res.ok({ ...r, page: Number(page) || 1, limit: Number(limit) || 20 }, '获取错题列表成功')
        } catch (e) {
            log.error('getWrongQuestions error:', e)
            return res.internal('获取错题列表失败')
        }
    }

    static async updateWrongQuestion(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的错题ID')

            const { mastery_level, tags, notes } = req.body
            const patch: any = {}
            if (mastery_level !== undefined) {
                const m = asMastery(mastery_level)
                if (!m) return res.badRequest('无效的掌握程度')
                patch.mastery_level = m
            }
            if (tags !== undefined) patch.tags = tags?.trim?.() || ''
            if (notes !== undefined) patch.notes = notes?.trim?.() || ''

            await svc.updateWrongQuestion(id, userId, patch)
            return res.ok(null, '错题更新成功')
        } catch (e) {
            log.error('updateWrongQuestion error:', e)
            return res.internal('错题更新失败')
        }
    }

    static async removeWrongQuestion(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的错题ID')
            await svc.removeWrongQuestion(id, userId)
            return res.ok(null, '错题移除成功')
        } catch (e) {
            log.error('removeWrongQuestion error:', e)
            return res.internal('错题移除失败')
        }
    }

    /** 兼容 question_id 或 wrong_question_id 的练习记录上报 */
    static async addPracticeRecord(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()

            let { wrong_question_id, question_id, is_correct, time_spent, answer } = req.body
            if (!wrong_question_id && !question_id) return res.badRequest('缺少必要参数：question_id 或 wrong_question_id')
            if (is_correct === undefined) return res.badRequest('缺少必要参数：is_correct')

            if (!wrong_question_id && question_id) {
                // 确保默认错题本
                const books = await svc.getUserBooks(userId)
                let defBook = (books as any[]).find(b => b.is_default)
                if (!defBook) {
                    const id = await svc.createBook({
                        user_id: userId,
                        name: '我的错题本',
                        description: '系统自动创建的默认错题本',
                        is_default: true,
                        is_public: false,
                    })
                    defBook = { id }
                }
                // ✅ 创建错题时带上 user_id
                wrong_question_id = await svc.addWrongQuestion({
                    user_id: Number(userId),
                    book_id: Number(defBook.id),
                    question_id: Number(question_id),
                    wrong_count: 1,
                    last_wrong_time: new Date(),
                    mastery_level: 'not_mastered',
                    tags: '',
                    notes: '',
                })
            }

            const recordId = await svc.addPracticeRecord({
                user_id: Number(userId),
                wrong_question_id: Number(wrong_question_id),
                is_correct: !!is_correct,
                time_spent: Number(time_spent ?? 0),
                practice_time: new Date(),
                // 可选：answer 字段如有存储需要可加到 practice_records 表
            } as any)

            return res.created({ record_id: recordId }, '练习记录添加成功')
        } catch (e) {
            log.error('addPracticeRecord error:', e)
            return res.internal('练习记录添加失败')
        }
    }

    /** 已练习题目ID列表 */
    static async getPracticedQuestions(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const limit = Number(req.query.limit ?? 1000)

            const rows =
                (await (svc as any).getPracticedQuestionIds?.(userId, limit)) ??
                (await (svc as any).getPracticeRecords?.(userId, { limit })) ??
                []
            const ids = Array.isArray(rows)
                ? rows.map((r: any) => Number(r?.question_id ?? r?.qid ?? r?.id)).filter((n: any) => Number.isFinite(n))
                : []
            return res.ok({ ids }, '获取已练习题目成功')
        } catch {
            return res.ok({ ids: [] }, '获取已练习题目成功')
        }
    }

    static async shareBook(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const id = Number(req.params.id)
            if (!Number.isFinite(id)) return res.badRequest('无效的错题本ID')
            const { shared_to, is_public = false, expires_at } = req.body

            const code = await svc.shareBook(id, userId, {
                shared_to: shared_to ? Number(shared_to) : undefined,
                is_public: !!is_public,
                expires_at,
            })
            return res.created({ share_code: code }, '错题本分享成功')
        } catch (e) {
            log.error('shareBook error:', e)
            return res.internal('错题本分享失败')
        }
    }

    static async getSharedBook(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const { shareCode } = req.params
            if (!shareCode) return res.badRequest('分享码不能为空')
            const r = await svc.getSharedBook(shareCode, userId)
            if (!r) return res.notFound('分享链接无效或已过期')
            return res.ok({ shared_book: r }, '获取分享错题本成功')
        } catch (e) {
            log.error('getSharedBook error:', e)
            return res.internal('获取分享错题本失败')
        }
    }

    static async getStatistics(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const s = await svc.getStatistics(userId)
            return res.ok({ statistics: s }, '获取统计信息成功')
        } catch (e) {
            log.error('getStatistics error:', e)
            return res.internal('获取统计信息失败')
        }
    }

    static async batchAddWrongQuestions(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const { book_id, questions, exam_result_id } = req.body
            if (!book_id || !Array.isArray(questions) || !questions.length) return res.badRequest('参数错误')

            // ✅ 传入 userId
            const r = await svc.batchAddWrongQuestions(
                Number(userId),
                Number(book_id),
                questions.map((q: any) => Number(q.question_id)),
                exam_result_id ? Number(exam_result_id) : undefined
            )
            return res.ok({ results: r }, '批量添加完成')
        } catch (e) {
            log.error('batchAddWrongQuestions error:', e)
            return res.internal('批量添加失败', { code: CODES.INTERNAL_ERROR })
        }
    }

    static async autoCollectWrongQuestions(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (!userId) return res.unauthorized()
            const { exam_result_id } = req.body
            if (!exam_result_id) return res.badRequest('考试结果ID不能为空')

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
                        user_id: Number(userId),                // ✅ 带上 user_id
                        book_id: Number(defaultBook.id),
                        question_id: Number(q.question_id),
                        exam_result_id: Number(exam_result_id),
                        wrong_count: 1,
                        last_wrong_time: new Date(),
                        mastery_level: 'not_mastered',
                        tags: q.subject || '',
                        notes: `来自考试：${q.exam_title || ''}`,
                    })
                    results.push({ question_id: Number(q.question_id), wrong_question_id: wid, success: true })
                } catch (e: any) {
                    results.push({ question_id: Number(q.question_id), success: false, error: e?.message })
                }
            }
            return res.ok(
                {
                    collected_count: results.filter(r => r.success).length,
                    total_count: wrongs.length,
                    results,
                },
                '自动收集错题完成'
            )
        } catch (e) {
            log.error('autoCollectWrongQuestions error:', e)
            return res.internal('自动收集错题失败')
        }
    }
}

export default WrongQuestionController
