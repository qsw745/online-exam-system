import { api } from '@shared/api/http'

export type PaperDifficulty = 'easy' | 'medium' | 'hard'

export interface Paper {
  id: string
  title: string
  description?: string
  total_score: number
  duration: number
  difficulty: PaperDifficulty
  created_at?: string
  updated_at?: string
  questions?: any[]
}

const pick = <T>(resp: any, fallback: T): T => {
  const d = resp?.data ?? resp
  return d?.data ?? d ?? fallback
}

const pickPaper = (resp: any): Paper | null => {
  const d = pick<any>(resp, {})
  const raw = d?.paper ?? d
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    description: raw.description ?? '',
    total_score: Number(raw.total_score ?? 100),
    duration: Number(raw.duration ?? 60),
    difficulty: (raw.difficulty ?? 'medium') as Paper['difficulty'],
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    questions: Array.isArray(raw.questions) ? raw.questions : undefined,
  }
}

const pickQuestions = (resp: any): any[] => {
  const d = pick<any>(resp, {})
  if (Array.isArray(d)) return d
  if (Array.isArray(d?.questions)) return d.questions
  if (Array.isArray(d?.items)) return d.items
  if (Array.isArray(d?.data?.questions)) return d.data.questions
  if (Array.isArray(d?.data?.items)) return d.data.items
  if (d && typeof d === 'object') return Object.values(d)
  return []
}

export const papersApi = {
  getById: async (id: string) => {
    const resp = await api.get(`/papers/${id}`)
    return pickPaper(resp)
  },
  getQuestions: async (id: string) => {
    const resp = await api.get(`/papers/${id}/questions`)
    return pickQuestions(resp)
  },
  create: (payload: Omit<Paper, 'id' | 'created_at' | 'updated_at' | 'questions'>) => api.post('/papers', payload),
  update: (id: string, payload: Omit<Paper, 'id' | 'created_at' | 'updated_at' | 'questions'>) =>
    api.put(`/papers/${id}`, payload),
}
