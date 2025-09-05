import { api } from '@shared/api/http'

export type Question = {
  id: string
  content: string
  type: string
  difficulty: 'easy' | 'medium' | 'hard' | string
  score: number
  knowledge_points: string[]
}

const normalize = (arr: any[] = []): Question[] =>
  arr.map(q => ({
    id: String(q.id ?? q.question_id ?? ''),
    content: q.content ?? q.title ?? '',
    type: q.type ?? q.question_type ?? 'unknown',
    difficulty: (q.difficulty ?? 'medium') as any,
    score: Number(q.score ?? 0),
    knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points : [],
  }))

export const questionsApi = {
  async list(params: { keyword?: string; type?: string; difficulty?: string }) {
    const resp: any = await api.get('/questions', { params })
    const d = resp?.data ?? resp
    if (Array.isArray(d)) return normalize(d)
    if (Array.isArray(d?.items)) return normalize(d.items)
    if (Array.isArray(d?.questions)) return normalize(d.questions)
    if (Array.isArray(d?.data?.items)) return normalize(d.data.items)
    if (Array.isArray(d?.data?.questions)) return normalize(d.data.questions)
    return []
  },
}
