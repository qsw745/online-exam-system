// features/questions/practice/utils/answer.ts
import { translate } from '@/shared/utils/i18n'

type AnyQuestion = {
  type?: string
  options?: Array<{ is_correct?: boolean; correct?: boolean } | any>
  correctIndices?: number[]
  correct_answer?: number[] | string
}

/** 判断作答是否正确（容错多种后端结构） */
export function isAnswerCorrect(q: AnyQuestion, selected: number[], text: string): boolean {
  const t = (q?.type || '').toString()

  if (t === 'short_answer') {
    // 简答题：前端仅判定“已作答”，正确性交给后台/阅卷
    return Boolean(text?.trim())
  }

  if (t === 'true_false') {
    const idx = String(q.correct_answer) === 'true' ? 0 : 1
    return selected?.[0] === idx
  }

  // 选择题：优先使用 correctIndices；其次从 options*.is_correct 推断；再次兜底 correct_answer:number[]
  let correct: number[] = Array.isArray(q.correctIndices) ? q.correctIndices.slice() : []

  if (!correct.length && Array.isArray(q.options)) {
    correct = q.options.map((o, i) => (o?.is_correct || o?.correct ? i : -1)).filter(i => i !== -1)
  }

  if (!correct.length && Array.isArray(q.correct_answer)) {
    correct = (q.correct_answer as number[]).map(n => Number(n)).filter(n => Number.isFinite(n))
  }

  const a = [...(selected || [])].sort((x, y) => x - y)
  const b = [...(correct || [])].sort((x, y) => x - y)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export const typeLabel = (t: string) =>
  (({
    single_choice: translate('questions.single_choice'),
    multiple_choice: translate('questions.multiple_choice'),
    true_false: translate('questions.judge'),
    short_answer: translate('questions.type_short'),
  } as any)[t] || t)

export const difficultyLabel = (d?: string) =>
  (({
    easy: translate('questions.easy'),
    medium: translate('questions.medium'),
    hard: translate('questions.hard'),
  } as any)[d || ''] || d)
