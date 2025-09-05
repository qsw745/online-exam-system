// features/questions/practice/utils/question-normalize.ts
import type { NormalizedQuestion, QuestionRaw } from '../types/question'

export function normalizeQuestion(q: QuestionRaw): NormalizedQuestion {
  const type = q.question_type
  if (type === 'true_false') {
    // 统一成两项：正确/错误
    const correctIndex = (q.correct_answer as string) === 'true' ? 0 : 1
    return {
      id: q.id,
      content: q.content ?? '',
      type,
      options: [{ content: '正确' }, { content: '错误' }],
      correctIndices: [correctIndex],
      explanation: q.explanation,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledge_points ?? [],
    }
  }

  if (type === 'single_choice' || type === 'multiple_choice') {
    const opts = (q.options ?? []).map(o => ({ content: o.content }))
    const correct = (q.options ?? []).map((o, i) => (o.is_correct ? i : -1)).filter(i => i >= 0)
    return {
      id: q.id,
      content: q.content ?? '',
      type,
      options: opts,
      correctIndices: correct,
      explanation: q.explanation,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledge_points ?? [],
    }
  }

  // short_answer
  return {
    id: q.id,
    content: q.content ?? '',
    type,
    options: [],
    correctIndices: [],
    explanation: q.explanation,
    difficulty: q.difficulty,
    knowledgePoints: q.knowledge_points ?? [],
  }
}
