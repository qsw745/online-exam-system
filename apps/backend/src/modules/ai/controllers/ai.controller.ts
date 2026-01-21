/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthRequest } from '@/types/auth'
import type { Res } from '@/types/response'
import { CODES } from '@/types/response'
import { AiService } from '../services/ai.service'
import { QuestionService } from '@/modules/questions/services/question.service'
import { getReqLogger } from '@/infrastructure/logging/logger'
import { AiSessionRepository } from '../repositories/ai-session.repository'
import { buildCacheKey, cacheGet, cacheSet } from '../services/ai.cache'
import { AI_CACHE_TTL_SEC } from '@/config/ai'
import { routeAgent } from '../services/ai.router'
import { ResultService } from '@/modules/exams/services/result.service'
import { AiKnowledgeService } from '../services/ai.knowledge'
import { AiKnowledgeRepository } from '../repositories/ai-knowledge.repository'
import { enqueueQuestionJob, ensureQuestionWorker, getQuestionJob } from '../services/ai.queue'
import { AiLogService } from '../services/ai-log.service'

const qsvc = new QuestionService()
const resultSvc = new ResultService()
ensureQuestionWorker()

const parseJson = <T>(value: any, fallback: T): T => {
  if (!value) return fallback
  if (Array.isArray(value)) return value as T
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return (parsed ?? fallback) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

const pickUser = (u: AuthRequest['user']) =>
  u
    ? ({
        id: u.id,
        role:
          (u as any).role ??
          (u as any).roles?.[0]?.code ??
          (u as any).roles?.[0] ??
          undefined,
      } as { id?: number; role?: string })
    : undefined

const sanitizeAction = (action: any) => {
  if (!action || typeof action !== 'object') return undefined
  const type = typeof action.type === 'string' ? action.type : undefined
  if (!type) return undefined
  const payload = action.payload && typeof action.payload === 'object' ? { ...action.payload } : undefined
  if (payload) {
    delete (payload as any).password
    delete (payload as any).current
    delete (payload as any).next
    delete (payload as any).token
    delete (payload as any).api_key
    delete (payload as any).apiKey
  }
  return payload ? { type, payload } : { type }
}

const normalizeText = (text: string) => String(text || '').replace(/\s+/g, ' ').trim()

const extractRenameInfo = (text: string) => {
  const clean = normalizeText(text)
  const stripQuotes = (val?: string) => String(val || '').replace(/["'“”]/g, '').trim()
  const newTitle =
    stripQuotes(clean.match(/(?:改为|改成|名称为|标题为|更名为)[:：\s]*([^\n，。,.]+)/)?.[1]) ||
    stripQuotes(clean.match(/将.+?改为[:：\s]*([^\n，。,.]+)/)?.[1])
  const oldTitle =
    stripQuotes(clean.match(/把(.+?)改为/)?.[1]) ||
    stripQuotes(clean.match(/将(.+?)改为/)?.[1])
  const useLatest = /最新|最近|上次|上一份/.test(clean)
  return { oldTitle: oldTitle || undefined, newTitle: newTitle || undefined, useLatest }
}

const extractStarterName = (text: string) => {
  const clean = normalizeText(text)
  const m = clean.match(/(?:流程)?发起人(?:员)?[:：\s]*([^\s，。]+)/)
  return m?.[1] ? String(m[1]).trim() : ''
}

const adjustAgentAction = (action: any, userText: string) => {
  if (!action || typeof action !== 'object') return action
  const type = String(action.type || '')
  const payload = action.payload && typeof action.payload === 'object' ? { ...action.payload } : {}
  const text = normalizeText(userText)
  const hasRenameIntent = /改名|更名|重命名|修改.*(名称|标题)|改为|改成/.test(text)
  const hasCreateIntent = /生成|创建|组卷/.test(text)

  if (type === 'create_paper') {
    if (hasRenameIntent && !hasCreateIntent) {
      const { oldTitle, newTitle, useLatest } = extractRenameInfo(text)
      if (newTitle && !payload.title) payload.title = newTitle
      if (oldTitle && !payload.current_title) payload.current_title = oldTitle
      if (useLatest) payload.use_latest_paper = true
      return { type: 'update_paper', payload }
    }
    if (/流程审核|审批/.test(text)) {
      payload.enable_review = payload.enable_review === undefined ? true : payload.enable_review
      const starterName = extractStarterName(text)
      if (starterName && !payload.starter_name) payload.starter_name = starterName
    }
    return { type, payload }
  }

  if (type === 'update_paper' && hasRenameIntent) {
    const { oldTitle, newTitle, useLatest } = extractRenameInfo(text)
    if (newTitle && !payload.title) payload.title = newTitle
    if (oldTitle && !payload.current_title) payload.current_title = oldTitle
    if (useLatest) payload.use_latest_paper = true
    return { type, payload }
  }

  return action
}

const sanitizeItems = (items: any[]) =>
  items
    .slice(-200)
    .map((item, idx) => {
      const role = item?.role === 'assistant' || item?.role === 'system' ? item.role : 'user'
      const content = String(item?.content || '').slice(0, 4000)
      const id = String(item?.id || `${Date.now()}-${idx}`)
      const action = sanitizeAction(item?.action)
      return { id, role, content, ...(action ? { action } : {}) }
    })
    .filter(i => i.content)

export class AiController {
  static async chat(req: AuthRequest, res: Res) {
    try {
      const prompt = String(req.body?.prompt || '').trim()
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : undefined
      if (!prompt && (!messages || messages.length === 0)) return res.badRequest('缺少 prompt 或 messages')
      const data = await AiService.chat(prompt, messages)
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 请求失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async generateQuestions(req: AuthRequest, res: Res) {
    try {
      const { persist } = req.body || {}
      const generated = await AiService.generateQuestions(req.body || {})
      const questions = (generated?.data as any)?.questions
      if (!persist || !Array.isArray(questions)) return res.ok(generated, 'OK')

      const created: any[] = []
      const errors: any[] = []
      for (const item of questions) {
        try {
          const payload = {
            title: item?.title,
            content: item?.content,
            question_type: item?.question_type,
            options: item?.options,
            correct_answer: item?.correct_answer,
            knowledge_points: item?.knowledge_points,
            tags: item?.tags,
            explanation: item?.explanation,
            difficulty: item?.difficulty,
          }
          const data = await qsvc.create({ id: req.user?.id, email: req.user?.email }, payload, {
            ip: req.ip,
            ua: req.get('User-Agent') || undefined,
          })
          created.push(data?.question ?? data)
        } catch (err: any) {
          errors.push({ error: err?.message || 'create_failed', item })
        }
      }
      return res.ok({ ...generated, created, errors }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 生成题目失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async generateQuestionsAsync(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const payload = req.body || {}
      const job = await enqueueQuestionJob(payload, { id: req.user.id, email: req.user.email })
      return res.ok({ jobId: job.id }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 生成题目失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getGenerateJob(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const jobId = String(req.params.id || '').trim()
      if (!jobId) return res.badRequest('缺少 jobId')
      const job = await getQuestionJob(jobId)
      if (!job) return res.notFound('任务不存在')
      const state = await job.getState()
      const progress = job.progress
      const result = state === 'completed' ? job.returnvalue : undefined
      const failedReason = state === 'failed' ? job.failedReason : undefined
      return res.ok({ id: job.id, state, progress, result, failedReason }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '查询任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async explainQuestion(req: AuthRequest, res: Res) {
    try {
      const { content, question_type } = req.body || {}
      if (!content || !question_type) return res.badRequest('缺少 content 或 question_type')
      const data = await AiService.explainQuestion(req.body || {})
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 解析失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async gradeShortAnswer(req: AuthRequest, res: Res) {
    try {
      const { question, answer } = req.body || {}
      if (!question || !answer) return res.badRequest('缺少 question 或 answer')
      const data = await AiService.gradeShortAnswer(req.body || {})
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 评分失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async summarizeExam(req: AuthRequest, res: Res) {
    try {
      const body = req.body || {}
      const examResultId = Number(body.exam_result_id ?? body.examResultId ?? body.result_id ?? '')
      const nocache = String(body.nocache || '').toLowerCase() === 'true'

      if (Number.isFinite(examResultId) && examResultId > 0) {
        const user = pickUser(req.user)
        const cacheKey = buildCacheKey('exam_summary', { userId: req.user?.id || null, examResultId })
        if (!nocache) {
          const hit = await cacheGet<any>(cacheKey)
          if (hit) return res.ok(hit, 'OK')
        }

        const detail: any = await resultSvc.getById(user, examResultId, 'questions')
        const payload = {
          exam: {
            id: detail.exam_id,
            paper_id: detail.paper_id,
            title: detail.paper_title,
          },
          result: {
            id: detail.id,
            score: detail.score,
            total_score: detail.total_score,
            percentage: detail.percentage,
            duration: detail.duration,
            status: detail.status,
          },
          questions: Array.isArray(detail.questions)
            ? detail.questions.map((q: any) => ({
                id: q.id,
                question_type: q.type,
                content: q.content,
                options: q.options,
                correct_answer: q.correct_answer,
                user_answer: q.user_answer,
                is_correct: q.is_correct,
                score: q.score,
              }))
            : [],
        }
        const data = await AiService.summarizeExam(payload)
        if (!nocache) await cacheSet(cacheKey, data, AI_CACHE_TTL_SEC)
        return res.ok(data, 'OK')
      }

      const { exam, result } = body
      if (!exam || !result) return res.badRequest('缺少 exam 或 result')
      const data = await AiService.summarizeExam(body || {})
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 总结失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async studyPlan(req: AuthRequest, res: Res) {
    try {
      const data = await AiService.buildStudyPlan(req.body || {})
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 计划生成失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async suggestPaper(req: AuthRequest, res: Res) {
    try {
      const data = await AiService.suggestPaperConfig(req.body || {})
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || 'AI 组卷建议失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async agent(req: AuthRequest, res: Res) {
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
      const safeMessages = messages
        .filter((m: any) => m && typeof m.content === 'string')
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
          content: String(m.content).slice(0, 4000),
        }))
      const lastUser = [...safeMessages].reverse().find(m => m.role === 'user')
      const routed = await routeAgent({ user: pickUser(req.user), message: lastUser?.content || '' })
      if (routed) {
        return res.ok({ data: routed, usage: { cached: true, routed: true } }, 'OK')
      }
      const context = {
        user: req.user ? { id: req.user.id, role: req.user.role, email: req.user.email } : null,
        orgId: (req as any).auth?.orgId ?? null,
      }
      const model = typeof req.body?.model === 'string' ? req.body.model.trim() : undefined
      const nocache = String(req.body?.nocache || '').toLowerCase() === 'true'
      const cacheKey = buildCacheKey('agent', {
        userId: req.user?.id || null,
        model: model || '',
        messages: safeMessages,
      })
      const data = await AiService.agent(safeMessages, context, model, { key: cacheKey, nocache })
      try {
        const payload = (data as any)?.data ?? {}
        const reply = typeof payload?.reply === 'string' ? payload.reply : String(payload?.reply || '')
        const rawAction = payload?.action && typeof payload.action === 'object' ? payload.action : undefined
        const adjustedAction = rawAction ? adjustAgentAction(rawAction, lastUser?.content || '') : undefined
        if (adjustedAction) payload.action = adjustedAction
        const sessionId = String(req.body?.sessionId || '').trim() || undefined
        if (req.user?.id && reply) {
          await AiLogService.recordAgentTurn({
            userId: req.user.id,
            sessionId,
            model: model || undefined,
            messages: [...safeMessages, { role: 'assistant', content: reply }],
            action: adjustedAction,
          })
        }
      } catch (logErr) {
        const logger = getReqLogger(req, { module: 'ai', action: 'agent' })
        logger.warn('ai.agent log failed', { error: logErr })
      }
      return res.ok(data, 'OK')
    } catch (e: any) {
      const logger = getReqLogger(req, { module: 'ai', action: 'agent' })
      logger.error('ai.agent failed', {
        model: typeof req.body?.model === 'string' ? req.body.model.trim() : undefined,
        messages: Array.isArray(req.body?.messages) ? req.body.messages.length : 0,
        error: e,
        errorMessage: e?.message || String(e),
      })
      return res.internal(e?.message || 'AI 助手失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listSessions(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const rows = await AiSessionRepository.listByUser(req.user.id)
      const sessions = rows.map(r => ({
        id: String(r.client_id),
        title: r.title || '新对话',
        items: parseJson<any[]>(r.items_json, []),
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime(),
      }))
      return res.ok(sessions, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '加载历史记录失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async upsertSession(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const clientId = String(req.params.id || '').trim()
      if (!clientId) return res.badRequest('缺少会话ID')
      const title = String(req.body?.title || '新对话').slice(0, 80)
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : []
      const items = sanitizeItems(rawItems)
      await AiSessionRepository.upsertSession({
        userId: req.user.id,
        clientId,
        title,
        itemsJson: JSON.stringify(items),
      })
      return res.ok({ id: clientId }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '保存历史记录失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async deleteSession(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const clientId = String(req.params.id || '').trim()
      if (!clientId) return res.badRequest('缺少会话ID')
      const ok = await AiSessionRepository.deleteSession(req.user.id, clientId)
      return res.ok({ deleted: ok }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '删除历史记录失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async addKnowledge(req: AuthRequest, res: Res) {
    try {
      const title = String(req.body?.title || '').trim()
      const content = String(req.body?.content || '').trim()
      const tags = String(req.body?.tags || '').trim()
      const source = String(req.body?.source || '').trim()
      if (!content) return res.badRequest('缺少 content')
      const data = await AiKnowledgeService.addDocument({
        title: title || undefined,
        content,
        tags: tags || undefined,
        source: source || undefined,
      })
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '知识库写入失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listKnowledge(req: AuthRequest, res: Res) {
    try {
      const page = Math.max(1, Number(req.query.page || 1))
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))
      const offset = (page - 1) * limit
      const list = await AiKnowledgeRepository.list(limit, offset)
      return res.ok({ list, page, limit }, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '知识库读取失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async searchKnowledge(req: AuthRequest, res: Res) {
    try {
      const q = String(req.body?.query || req.body?.q || '').trim()
      if (!q) return res.badRequest('缺少 query')
      const topK = Math.min(10, Math.max(1, Number(req.body?.topK || 3)))
      const data = await AiKnowledgeService.search(q, topK)
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '知识库搜索失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listLogs(req: AuthRequest, res: Res) {
    try {
      const q = {
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        keyword: String(req.query.keyword || '').trim() || undefined,
        model: String(req.query.model || '').trim() || undefined,
        sessionId: String(req.query.session_id || '').trim() || undefined,
        userId: req.query.user_id ? Number(req.query.user_id) : undefined,
        startDate: String(req.query.start_date || '').trim() || undefined,
        endDate: String(req.query.end_date || '').trim() || undefined,
      }
      const data = await AiLogService.listLogs(
        {
          id: req.user?.id,
          role: (req.user as any)?.role || undefined,
          isAdmin: !!(req.user as any)?.isAdmin,
        },
        q
      )
      return res.ok(data, 'OK')
    } catch (e: any) {
      return res.internal(e?.message || '加载AI问答记录失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async exportLogs(req: AuthRequest, res: Res) {
    try {
      const q = {
        keyword: String(req.query.keyword || '').trim() || undefined,
        model: String(req.query.model || '').trim() || undefined,
        sessionId: String(req.query.session_id || '').trim() || undefined,
        userId: req.query.user_id ? Number(req.query.user_id) : undefined,
        startDate: String(req.query.start_date || '').trim() || undefined,
        endDate: String(req.query.end_date || '').trim() || undefined,
      }
      const lines = await AiLogService.exportJsonl(
        {
          id: req.user?.id,
          role: (req.user as any)?.role || undefined,
          isAdmin: !!(req.user as any)?.isAdmin,
        },
        q
      )
      res.setHeader('Content-Type', 'application/jsonl; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="ai-train.jsonl"')
      return res.send(lines.join('\n') + (lines.length ? '\n' : ''))
    } catch (e: any) {
      return res.internal(e?.message || '导出AI问答记录失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
