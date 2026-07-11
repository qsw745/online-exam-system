/* eslint-disable @typescript-eslint/no-explicit-any */
import { AI_CACHE_TTL_SEC, AI_QUESTION_TIMEOUT_MS, ensureAiEnabled } from '@/config/ai'
import { normalizeQuestionContent, validateQuestionQuality } from '@/modules/questions/utils/question-quality'
import { cacheGet, cacheSet } from './ai.cache'
import { AiKnowledgeService } from './ai.knowledge'
import { chatCompletion, chatCompletionStream, type ChatMessage } from './ai.client'
import {
  AGENT_SCHEMA,
  AGENT_STREAM_FORMAT,
  AGENT_SYSTEM,
  EXAM_SUMMARY_SCHEMA,
  EXAM_SUMMARY_SYSTEM,
  PAPER_SUGGEST_SCHEMA,
  PAPER_SUGGEST_SYSTEM,
  QUESTION_EXPLAIN_SCHEMA,
  QUESTION_EXPLAIN_SYSTEM,
  QUESTION_GEN_SCHEMA,
  QUESTION_GEN_SYSTEM,
  SHORT_ANSWER_GRADE_SCHEMA,
  SHORT_ANSWER_GRADE_SYSTEM,
  STUDY_PLAN_SCHEMA,
  STUDY_PLAN_SYSTEM,
  SYSTEM_BASE,
} from './ai.prompts'

function tryParseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {}
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1])
    } catch {}
  }
  const loose = text.match(/\{[\s\S]*\}/)
  if (loose?.[0]) {
    try {
      return JSON.parse(loose[0])
    } catch {}
  }
  return null
}

function systemMessage(extra?: string): ChatMessage {
  return { role: 'system', content: `${SYSTEM_BASE}\n${extra || ''}`.trim() }
}

const AGENT_ACTIONS = new Set([
  'navigate',
  'open_url',
  'send_mail',
  'generate_questions',
  'create_paper',
  'create_task',
  'create_user',
  'create_org',
  'assign_role',
  'update_paper',
  'suggest_paper',
  'study_plan',
  'explain_question',
  'summarize_exam',
  'change_password',
  'reset_password',
  'run_test',
])

// ✅/⚠️/❌ 开头的行是"系统执行结果"专用信号（executeAction/任务轮询产出）。
// 模型伪造这类行会让用户误信操作已完成（曾伪造"✅ 试卷已创建成功 ID:1"），一律剥除。
// 兼容伪装形态：行首可能带列表序号（"1. ✅"/"- ✅"）或加粗（"**✅"）
const FAKE_RESULT_LINE = /^\s*(?:[-*>]\s*|\d+\s*[.、)]\s*)?(?:\*\*\s*)?(✅|⚠️|❌|\[✓\]|☑️)/u

function stripFakeResultLines(text: string): string {
  if (!text) return text
  return text
    .split('\n')
    .filter(line => !FAKE_RESULT_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeAgentOutput(raw: any) {
  const reply = stripFakeResultLines(
    typeof raw?.reply === 'string' ? raw.reply : String(raw?.reply ?? raw?.message ?? '')
  )
  const action = raw?.action && typeof raw.action === 'object' ? raw.action : null
  const type = typeof action?.type === 'string' ? action.type : null
  if (!type || !AGENT_ACTIONS.has(type)) return { reply }
  const payload = action?.payload && typeof action.payload === 'object' ? action.payload : {}
  return { reply, action: { type, payload } }
}

function sanitizeGeneratedQuestions(data: any) {
  if (!data || !Array.isArray(data.questions)) return data
  const accepted: any[] = []
  const rejected: any[] = []

  data.questions.forEach((item: any, index: number) => {
    const content = normalizeQuestionContent(item?.content)
    const issues = validateQuestionQuality({ content, question_type: item?.question_type })
    if (issues.length) {
      rejected.push({ index, issues, item })
      return
    }
    accepted.push({ ...item, content })
  })

  return {
    ...data,
    questions: accepted,
    rejected_questions: rejected,
  }
}

export class AiService {
  static async chat(prompt: string, messages?: ChatMessage[]) {
    ensureAiEnabled()
    const merged: ChatMessage[] = [systemMessage(), ...(messages || [])]
    if (prompt) merged.push({ role: 'user', content: prompt })
    const { content, usage } = await chatCompletion({ messages: merged })
    return { reply: content, usage }
  }

  static async generateQuestions(input: any) {
    ensureAiEnabled()
    const existingTitles = Array.isArray(input?.existing_titles)
      ? input.existing_titles.filter((t: any) => typeof t === 'string' && t).slice(-60)
      : []
    const payload = {
      subject: input?.subject,
      difficulty: input?.difficulty,
      question_type: input?.question_type,
      count: input?.count ?? 5,
      knowledge_points: input?.knowledge_points,
      tags: input?.tags,
      language: 'zh-CN',
      // 多批生成时喂回已出过的题干，配合系统提示词避免跨批重复、要求覆盖不同子领域
      ...(existingTitles.length ? { existing_questions: existingTitles } : {}),
      ...(Number(input?.batch_index) > 0 ? { batch_index: Number(input.batch_index) } : {}),
    }
    const prompt = `${QUESTION_GEN_SYSTEM}\n${QUESTION_GEN_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    // 输出长度按题量估算（每题约 400 token），否则全局 maxTokens(默认1200) 会把多题 JSON 截断导致解析失败
    const count = Math.max(1, Number(payload.count) || 5)
    const maxTokens = Math.min(7900, Math.max(1500, count * 400 + 400))
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
      maxTokens,
      timeoutMs: typeof input?.timeout_ms === 'number' ? input.timeout_ms : AI_QUESTION_TIMEOUT_MS,
    })
    const data = sanitizeGeneratedQuestions(tryParseJson(content) ?? { raw: content })
    return { data, usage, raw: content }
  }

  static async explainQuestion(input: any) {
    ensureAiEnabled()
    const payload = {
      question_type: input?.question_type,
      content: input?.content,
      options: input?.options,
      correct_answer: input?.correct_answer,
      user_answer: input?.user_answer,
    }
    const prompt = `${QUESTION_EXPLAIN_SYSTEM}\n${QUESTION_EXPLAIN_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
    })
    const data = tryParseJson(content) ?? { raw: content }
    return { data, usage, raw: content }
  }

  static async gradeShortAnswer(input: any) {
    ensureAiEnabled()
    const payload = {
      question: input?.question,
      rubric: input?.rubric,
      answer: input?.answer,
      max_score: input?.max_score ?? 10,
    }
    const prompt = `${SHORT_ANSWER_GRADE_SYSTEM}\n${SHORT_ANSWER_GRADE_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
    })
    const data = tryParseJson(content) ?? { raw: content }
    return { data, usage, raw: content }
  }

  static async summarizeExam(input: any) {
    ensureAiEnabled()
    const payload = {
      exam: input?.exam,
      result: input?.result,
      questions: input?.questions,
    }
    const prompt = `${EXAM_SUMMARY_SYSTEM}\n${EXAM_SUMMARY_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
    })
    const data = tryParseJson(content) ?? { raw: content }
    return { data, usage, raw: content }
  }

  static async buildStudyPlan(input: any) {
    ensureAiEnabled()
    const payload = {
      profile: input?.profile,
      goals: input?.goals,
      wrong_questions: input?.wrong_questions,
      time_range: input?.time_range,
    }
    const prompt = `${STUDY_PLAN_SYSTEM}\n${STUDY_PLAN_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
    })
    const data = tryParseJson(content) ?? { raw: content }
    return { data, usage, raw: content }
  }

  static async suggestPaperConfig(input: any) {
    ensureAiEnabled()
    const payload = {
      target: input?.target,
      totalQuestions: input?.totalQuestions,
      totalScore: input?.totalScore,
      difficulty: input?.difficulty,
      questionTypes: input?.questionTypes,
      knowledgePoints: input?.knowledgePoints,
      duration: input?.duration,
    }
    const prompt = `${PAPER_SUGGEST_SYSTEM}\n${PAPER_SUGGEST_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
    })
    const data = tryParseJson(content) ?? { raw: content }
    return { data, usage, raw: content }
  }

  static async agent(
    messages: ChatMessage[] = [],
    context?: any,
    model?: string,
    cache?: { key?: string; ttlSec?: number; nocache?: boolean },
    onStage?: (key: 'knowledge' | 'cache_hit' | 'llm' | 'parse') => void
  ) {
    ensureAiEnabled()
    const ctx = context ? `Context:\n${JSON.stringify(context)}` : ''
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser?.content) onStage?.('knowledge')
    const knowledge = lastUser?.content ? await AiKnowledgeService.search(lastUser.content) : []
    const knowledgeText = knowledge.length
      ? `Knowledge snippets:\n${knowledge
          .map(k => `- ${[k.title, k.source].filter(Boolean).join(' / ')}\n${k.content}`)
          .join('\n')}`
      : ''
    const prompt = `${AGENT_SYSTEM}\n${AGENT_SCHEMA}\n${ctx}\n${knowledgeText}`.trim()
    if (cache?.key && !cache?.nocache) {
      const hit = await cacheGet<{ data: any; usage?: any; raw?: any }>(cache.key)
      if (hit) {
        onStage?.('cache_hit')
        return { ...hit, cached: true }
      }
    }
    onStage?.('llm')
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'system', content: prompt }, ...(messages || [])],
      model,
      jsonObject: true,
    })
    onStage?.('parse')
    const parsed = tryParseJson(content) ?? { reply: content }
    const data = sanitizeAgentOutput(parsed)
    const result = { data, usage, raw: content }
    if (cache?.key && !cache?.nocache) {
      await cacheSet(cache.key, result, cache?.ttlSec ?? AI_CACHE_TTL_SEC)
    }
    return result
  }

  /**
   * 流式版 agent：LLM 按「自然语言 + 末尾 \`\`\`action 围栏」输出；
   * 可见文本逐段回调 onVisibleDelta（拦住围栏起始后停止透传），末尾解析动作。
   * 模型不守协议回退纯 JSON 时自动容错（整体缓冲后按旧协议解析，可见增量为 0，调用方需补发全文）。
   */
  static async agentStream(
    messages: ChatMessage[] = [],
    context?: any,
    model?: string,
    cache?: { key?: string; ttlSec?: number; nocache?: boolean },
    onStage?: (key: 'knowledge' | 'cache_hit' | 'llm' | 'parse') => void,
    onVisibleDelta?: (text: string) => void
  ): Promise<{ data: { reply: string; action?: any }; usage?: any; cached?: boolean; visibleEmitted: number }> {
    ensureAiEnabled()
    const ctx = context ? `Context:\n${JSON.stringify(context)}` : ''
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser?.content) onStage?.('knowledge')
    const knowledge = lastUser?.content ? await AiKnowledgeService.search(lastUser.content) : []
    const knowledgeText = knowledge.length
      ? `Knowledge snippets:\n${knowledge
          .map(k => `- ${[k.title, k.source].filter(Boolean).join(' / ')}\n${k.content}`)
          .join('\n')}`
      : ''
    const prompt = `${AGENT_SYSTEM}\n${AGENT_SCHEMA}\n${AGENT_STREAM_FORMAT}\n${ctx}\n${knowledgeText}`.trim()

    if (cache?.key && !cache?.nocache) {
      const hit = await cacheGet<{ data: any; usage?: any }>(cache.key)
      if (hit) {
        onStage?.('cache_hit')
        return { data: hit.data, usage: hit.usage, cached: true, visibleEmitted: 0 }
      }
    }

    onStage?.('llm')
    const FENCE = '```'
    const HOLDBACK = 4 // 围栏可能被切成多个增量，保留尾部避免把 "``" 提前吐给用户
    let full = ''
    let emitted = 0
    let visibleStarted = false
    let suppress = false
    let rawJsonMode: boolean | null = null

    // 按行过滤伪造结果行后再透传：行首缓冲 3 个字符探测 ✅/⚠️/❌，放行后恢复逐段输出
    let emittedChars = 0
    let lineMode: 'probe' | 'pass' | 'drop' = 'probe'
    let probeBuf = ''
    const emitVisible = (s: string) => {
      onVisibleDelta!(s)
      emittedChars += s.length
    }
    const pushVisible = (chunk: string) => {
      if (!onVisibleDelta) return
      let rest = chunk
      while (rest.length) {
        const nl = rest.indexOf('\n')
        const seg = nl === -1 ? rest : rest.slice(0, nl + 1)
        rest = nl === -1 ? '' : rest.slice(nl + 1)
        const endsLine = seg.endsWith('\n')
        if (lineMode === 'pass') {
          emitVisible(seg)
        } else if (lineMode === 'probe') {
          probeBuf += seg
          const ready = endsLine || probeBuf.trimStart().length >= 3
          if (ready) {
            if (FAKE_RESULT_LINE.test(probeBuf)) {
              lineMode = 'drop'
            } else {
              emitVisible(probeBuf)
              lineMode = 'pass'
            }
            probeBuf = ''
          }
        }
        // drop 模式：吞掉伪造行的剩余内容
        if (endsLine) lineMode = 'probe'
      }
    }
    const flushVisible = () => {
      if (!onVisibleDelta) return
      if (lineMode === 'probe' && probeBuf && !FAKE_RESULT_LINE.test(probeBuf)) emitVisible(probeBuf)
      probeBuf = ''
    }

    const { content, usage } = await chatCompletionStream(
      { messages: [systemMessage(), { role: 'system', content: prompt }, ...(messages || [])], model },
      piece => {
        full += piece
        if (rawJsonMode === null) {
          const head = full.trimStart()
          if (!head) return
          rawJsonMode = head.startsWith('{')
        }
        if (rawJsonMode || suppress || !onVisibleDelta) return
        // 正文开始前的纯空白不透传（模型直接进围栏时只有换行，透传会渲染成"空白气泡"）
        if (!visibleStarted) {
          const firstVisible = full.search(/\S/)
          if (firstVisible === -1) return
          if (full.startsWith(FENCE, firstVisible)) {
            suppress = true
            return
          }
          visibleStarted = true
          emitted = firstVisible
        }
        const fenceIdx = full.indexOf(FENCE)
        const visibleEnd = fenceIdx !== -1 ? fenceIdx : Math.max(emitted, full.length - HOLDBACK)
        if (fenceIdx !== -1) suppress = true
        if (visibleEnd > emitted) {
          pushVisible(full.slice(emitted, visibleEnd))
          emitted = visibleEnd
        }
      }
    )

    onStage?.('parse')
    let data: { reply: string; action?: any }
    if (rawJsonMode) {
      // 模型没守流式协议，按旧 JSON 协议解析
      const parsed = tryParseJson(content) ?? { reply: content }
      data = sanitizeAgentOutput(parsed)
    } else {
      const fenceIdx = content.indexOf(FENCE)
      const replyText = (fenceIdx !== -1 ? content.slice(0, fenceIdx) : content).trim()
      // 把剩余可见文本冲出去（去掉围栏后的部分）；正文从未开始时不冲纯空白，避免空白气泡
      const visibleEnd = fenceIdx !== -1 ? fenceIdx : content.length
      if (onVisibleDelta && visibleEnd > emitted) {
        const tailChunk = content.slice(emitted, visibleEnd)
        if (visibleStarted || tailChunk.trim()) {
          pushVisible(tailChunk)
          emitted = visibleEnd
        }
      }
      flushVisible()
      let action: any
      const fenced = content.match(/```(?:action|json)?\s*([\s\S]*?)```/i)
      if (fenced?.[1]) {
        // 宽松解析：模型偶有围栏内多余文字/换行，剥出最外层大括号再试
        try {
          action = JSON.parse(fenced[1])
        } catch {
          const braces = fenced[1].match(/\{[\s\S]*\}/)
          if (braces) {
            try {
              action = JSON.parse(braces[0])
            } catch {}
          }
        }
      }
      data = sanitizeAgentOutput({ reply: replyText, action })
    }
    if (cache?.key && !cache?.nocache) {
      await cacheSet(cache.key, { data, usage, raw: content }, cache?.ttlSec ?? AI_CACHE_TTL_SEC)
    }
    return { data, usage, visibleEmitted: emittedChars }
  }
}
