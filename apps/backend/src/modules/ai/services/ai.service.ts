/* eslint-disable @typescript-eslint/no-explicit-any */
import { AI_CACHE_TTL_SEC, AI_QUESTION_TIMEOUT_MS, ensureAiEnabled, resolveAiModel } from '@/config/ai'
import { cacheGet, cacheSet } from './ai.cache'
import { AiKnowledgeService } from './ai.knowledge'
import { chatCompletion, type ChatMessage } from './ai.client'
import {
  AGENT_SCHEMA,
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

function sanitizeAgentOutput(raw: any) {
  const reply = typeof raw?.reply === 'string' ? raw.reply : String(raw?.reply ?? raw?.message ?? '')
  const action = raw?.action && typeof raw.action === 'object' ? raw.action : null
  const type = typeof action?.type === 'string' ? action.type : null
  if (!type || !AGENT_ACTIONS.has(type)) return { reply }
  const payload = action?.payload && typeof action.payload === 'object' ? action.payload : {}
  return { reply, action: { type, payload } }
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
    const payload = {
      subject: input?.subject,
      difficulty: input?.difficulty,
      question_type: input?.question_type,
      count: input?.count ?? 5,
      knowledge_points: input?.knowledge_points,
      tags: input?.tags,
      language: 'zh-CN',
    }
    const prompt = `${QUESTION_GEN_SYSTEM}\n${QUESTION_GEN_SCHEMA}\n\nInput:\n${JSON.stringify(payload)}`
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'user', content: prompt }],
      jsonObject: true,
      timeoutMs: typeof input?.timeout_ms === 'number' ? input.timeout_ms : AI_QUESTION_TIMEOUT_MS,
    })
    const data = tryParseJson(content) ?? { raw: content }
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
    cache?: { key?: string; ttlSec?: number; nocache?: boolean }
  ) {
    ensureAiEnabled()
    const ctx = context ? `Context:\n${JSON.stringify(context)}` : ''
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const knowledge = lastUser?.content ? await AiKnowledgeService.search(lastUser.content) : []
    const knowledgeText = knowledge.length
      ? `Knowledge snippets:\n${knowledge
          .map(k => `- ${[k.title, k.source].filter(Boolean).join(' / ')}\n${k.content}`)
          .join('\n')}`
      : ''
    const prompt = `${AGENT_SYSTEM}\n${AGENT_SCHEMA}\n${ctx}\n${knowledgeText}`.trim()
    if (cache?.key && !cache?.nocache) {
      const hit = await cacheGet<{ data: any; usage?: any; raw?: any }>(cache.key)
      if (hit) return { ...hit, cached: true }
    }
    const { content, usage } = await chatCompletion({
      messages: [systemMessage(), { role: 'system', content: prompt }, ...(messages || [])],
      model: resolveAiModel(model),
      jsonObject: true,
    })
    const parsed = tryParseJson(content) ?? { reply: content }
    const data = sanitizeAgentOutput(parsed)
    const result = { data, usage, raw: content }
    if (cache?.key && !cache?.nocache) {
      await cacheSet(cache.key, result, cache?.ttlSec ?? AI_CACHE_TTL_SEC)
    }
    return result
  }
}
