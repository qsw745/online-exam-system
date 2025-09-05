// features/questions/practice/utils/answer.ts
import type { NormalizedQuestion } from '../types/question'

export function isAnswerCorrect(q: NormalizedQuestion, selected: number[], text: string): boolean {
  if (q.type === 'short_answer') return Boolean(text.trim()) // 简答先判“已作答”，正确性交给阅卷/后台
  const a = [...selected].sort()
  const b = [...q.correctIndices].sort()
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export const typeLabel = (t: string) =>
  (({ single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', short_answer: '简答题' } as any)[t] ||
  t)

export const difficultyLabel = (d?: string) => (({ easy: '简单', medium: '中等', hard: '困难' } as any)[d || ''] || d)
