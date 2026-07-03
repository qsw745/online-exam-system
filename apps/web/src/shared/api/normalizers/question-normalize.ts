// features/questions/utils/question-normalize.ts
import type { OptionDTO, QuestionDTO, QuestionType } from '@/shared/types/question'
import { translate } from '@/shared/utils/i18n'

export const ensureArrayFromMaybeCsv = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map(String).filter(Boolean)
  if (typeof input === 'string')
    return input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  return []
}

export const parseMaybeJsonArray = (raw: unknown): any[] | null => {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const arr = JSON.parse(s)
        return Array.isArray(arr) ? arr : null
      } catch {}
    }
  }
  return null
}

export const parseTags = (raw: unknown): string[] => {
  const arr = parseMaybeJsonArray(raw)
  return arr ? arr.map(String).filter(Boolean) : ensureArrayFromMaybeCsv(raw)
}

export const parseOptions = (raw: unknown): OptionDTO[] => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(v)) return []
    return v.filter(Boolean).map(it => ({ content: String(it.content ?? ''), is_correct: !!it.is_correct }))
  } catch {
    return []
  }
}

export const applyCorrect = (opts: OptionDTO[], correct: unknown): OptionDTO[] => {
  if (!opts.length) return opts
  let indices: number[] = []

  const fromArray = (arr: unknown) =>
    Array.isArray(arr) ? arr.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < opts.length) : null

  if (Array.isArray(correct)) indices = fromArray(correct) ?? []
  else if (typeof correct === 'string') {
    const s = correct.trim()
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        indices = fromArray(JSON.parse(s)) ?? []
      } catch {}
    }
    if (!indices.length) {
      const parts = s
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
      const allLetters = parts.every(p => /^[A-Za-z]$/.test(p))
      indices = allLetters ? parts.map(p => p.toUpperCase().charCodeAt(0) - 65) : parts.map(Number)
      indices = indices.filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
    }
  }
  return opts.map((o, i) => ({ ...o, is_correct: indices.includes(i) }))
}

export const normalizeFromServer = (raw: any): QuestionDTO => {
  const q = raw?.question ?? raw ?? {}
  const type: QuestionType = q.question_type ?? 'single_choice'
  const options = parseOptions(q.options)
  const withCorrect = options.length ? applyCorrect(options, q.correct_answer) : options

  return {
    id: String(q.id ?? ''),
    content: String(q.content ?? ''),
    question_type: type,
    options: withCorrect,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? '',
    knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points : [],
    tags: parseTags(q.tags),
    score: Number(q.score ?? 10),
  }
}

export const buildPayload = (form: {
  id?: string
  content: string
  type: QuestionType
  options: OptionDTO[]
  answer: string | '' // true_false: 'true'|'false'；short_answer: 文本
  explanation: string
  knowledgePoints: string[]
  tags: string[]
  score?: number
}) => {
  const base: any = {
    content: form.content.trim(),
    question_type: form.type,
    knowledge_points: form.knowledgePoints,
    tags: form.tags,
    explanation: form.explanation?.trim(),
    score: Number(form.score ?? 10),
    exam_id: 1, // 保留原有
  }

  if (form.type === 'single_choice' || form.type === 'multiple_choice') {
    base.options = form.options
    base.correct_answer = form.options.map((o, i) => (o.is_correct ? i : null)).filter((v): v is number => v !== null)
  } else if (form.type === 'true_false') {
    base.options = [{ content: translate('questions.tf_true') }, { content: translate('questions.tf_false') }]
    base.correct_answer = [form.answer === 'true' ? 0 : 1]
  } else if (form.type === 'short_answer') {
    base.options = []
    base.correct_answer = form.answer
    base.answer = form.answer
  }
  return base
}
