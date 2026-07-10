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
      const rejected = Array.isArray((generated?.data as any)?.rejected_questions)
        ? (generated?.data as any).rejected_questions
        : []
      const errors: any[] = rejected.map((item: any) => ({
        error: Array.isArray(item?.issues) ? item.issues.join('；') : 'question_quality_failed',
        item: item?.item,
      }))
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
      // 多步循环的系统续跑指令直达大模型（同 agentStream 的 internal 语义）
      const isInternalReq = req.body?.internal === true
      const routed = isInternalReq ? null : await routeAgent({ user: pickUser(req.user), message: lastUser?.content || '' })
      if (routed) {
        // 规则路由命中的对话同样记入 AI 问答日志（model 标记 rule-router 以便区分）
        if (req.user?.id && routed.reply) {
          const routedSessionId = String(req.body?.sessionId || '').trim() || undefined
          await AiLogService.recordAgentTurn({
            userId: req.user.id,
            sessionId: routedSessionId,
            model: 'rule-router',
            messages: [...safeMessages, { role: 'assistant', content: routed.reply }],
            action: routed.action,
          }).catch(() => {})
        }
        return res.ok({ data: routed, usage: { cached: true, routed: true } }, 'OK')
      }
      const context = {
        user: req.user ? { id: req.user.id, role: req.user.role, email: req.user.email } : null,
        orgId: (req as any).auth?.orgId ?? null,
        // 当前时间：模型不知道"今天"，缺了会把任务时间写成过去的年份
        now: new Date().toISOString(),
      }
      const model = typeof req.body?.model === 'string' ? req.body.model.trim() : undefined
      const nocache = isInternalReq || String(req.body?.nocache || '').toLowerCase() === 'true'
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

  /**
   * SSE 版 agent：把处理过程实时推给前端。
   * 事件：stage {key,label} 阶段提示 → delta {text} 回复增量 → action {..} 建议动作 → done {usage} / error {message}
   */
  static async agentStream(req: AuthRequest, res: Res) {
    const raw = res as any
    let closed = false
    req.on?.('close', () => {
      closed = true
    })

    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    raw.flushHeaders?.()

    const emit = (event: string, data: unknown) => {
      if (closed) return
      raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
    const finish = () => {
      if (!closed) raw.end()
      closed = true
    }
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    // 逐字下发回复（分片 + 微延迟，前端呈现打字效果；连接断开立即停）
    const emitReplyChunks = async (reply: string) => {
      const text = String(reply || '')
      const chunk = Math.max(4, Math.ceil(text.length / 60))
      for (let pos = 0; pos < text.length && !closed; pos += chunk) {
        emit('delta', { text: text.slice(pos, pos + chunk) })
        await sleep(16)
      }
    }

    const STAGE_LABELS: Record<string, string> = {
      analyze: '正在分析请求…',
      route_hit: '命中快捷指令，直接处理',
      knowledge: '正在检索知识库…',
      cache_hit: '命中缓存结果',
      llm: '正在调用大模型…',
      parse: '正在解析动作…',
    }
    const stage = (key: string) => emit('stage', { key, label: STAGE_LABELS[key] || key })

    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
      const safeMessages = messages
        .filter((m: any) => m && typeof m.content === 'string')
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
          content: String(m.content).slice(0, 4000),
        }))
      const lastUser = [...safeMessages].reverse().find(m => m.role === 'user')
      const sessionId = String(req.body?.sessionId || '').trim() || undefined
      // 多步循环的系统续跑指令：必须直达大模型做规划，不能被规则路由的关键词误吞，也不能命中旧缓存
      const isInternal = req.body?.internal === true

      stage('analyze')

      // 1) 规则路由（快捷指令等确定性场景；内部续跑指令跳过）
      const routed = isInternal ? null : await routeAgent({ user: pickUser(req.user), message: lastUser?.content || '' })
      if (routed) {
        stage('route_hit')
        if (req.user?.id && routed.reply) {
          await AiLogService.recordAgentTurn({
            userId: req.user.id,
            sessionId,
            model: 'rule-router',
            messages: [...safeMessages, { role: 'assistant', content: routed.reply }],
            action: routed.action,
          }).catch(() => {})
        }
        await emitReplyChunks(routed.reply || '')
        if (routed.action) emit('action', routed.action)
        emit('done', { usage: { cached: true, routed: true } })
        return finish()
      }

      // 2) 大模型
      const context = {
        user: req.user ? { id: req.user.id, role: req.user.role, email: req.user.email } : null,
        orgId: (req as any).auth?.orgId ?? null,
        // 当前时间：模型不知道"今天"，缺了会把任务时间写成过去的年份
        now: new Date().toISOString(),
      }
      const model = typeof req.body?.model === 'string' ? req.body.model.trim() : undefined
      const nocache = isInternal || String(req.body?.nocache || '').toLowerCase() === 'true'
      const cacheKey = buildCacheKey('agent', {
        userId: req.user?.id || null,
        model: model || '',
        messages: safeMessages,
      })
      // token 级透传：模型可见文本边生成边下发；围栏动作块在服务端截住解析
      const result = await AiService.agentStream(
        safeMessages,
        context,
        model,
        { key: cacheKey, nocache },
        stage,
        text => emit('delta', { text })
      )

      const payload = result?.data ?? ({} as any)
      const reply = typeof payload?.reply === 'string' ? payload.reply : String(payload?.reply || '')
      const rawAction = payload?.action && typeof payload.action === 'object' ? payload.action : undefined
      const adjustedAction = rawAction ? adjustAgentAction(rawAction, lastUser?.content || '') : undefined

      if (req.user?.id && reply) {
        await AiLogService.recordAgentTurn({
          userId: req.user.id,
          sessionId,
          model: model || undefined,
          messages: [...safeMessages, { role: 'assistant', content: reply }],
          action: adjustedAction,
        }).catch(logErr => {
          getReqLogger(req, { module: 'ai', action: 'agent.stream' }).warn('ai.agent.stream log failed', { error: logErr })
        })
      }

      // 缓存命中或模型回退纯 JSON 时没有 token 透传，补发全文（打字机分片）
      if (!result.visibleEmitted) await emitReplyChunks(reply)
      if (adjustedAction) emit('action', adjustedAction)
      emit('done', { usage: result?.usage, cached: !!result?.cached })
      return finish()
    } catch (e: any) {
      getReqLogger(req, { module: 'ai', action: 'agent.stream' }).error('ai.agent.stream failed', {
        error: e,
        errorMessage: e?.message || String(e),
      })
      emit('error', { message: e?.message || 'AI 助手失败' })
      return finish()
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
