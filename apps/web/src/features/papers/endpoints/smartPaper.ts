// features/smart-paper/endpoints/smartPaper.ts
import { api } from '@shared/api/http'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed'
export type QTypeKey = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'

export interface Question {
  id: number
  content: string
  question_type: string
  difficulty: string
  score: number
  knowledge_points?: string[]
}

export interface SmartPaperConfig {
  title: string
  description: string
  duration: number
  difficulty: Difficulty
  totalQuestions: number
  questionTypes: Record<QTypeKey, number>
  difficultyDistribution: { easy: number; medium: number; hard: number }
  knowledgePoints: string[]
  totalScore: number
}

const pickData = <T>(resp: any, fallback: T): T => {
  const d = resp?.data ?? resp
  if (d?.data !== undefined) return d.data as T
  return (d as T) ?? fallback
}

export const smartPaperApi = {
  async getKnowledgePoints(): Promise<string[]> {
    const resp = await api.get('/questions/knowledge-points')
    const list = pickData<string[] | { items?: string[] }>(resp, [])
    return Array.isArray(list) ? list : list?.items ?? []
  },

  async generate(cfg: SmartPaperConfig): Promise<Question[]> {
    const resp = await api.post('/papers/smart-generate', cfg)
    const d = pickData<any>(resp, {})
    const arr: Question[] = Array.isArray(d?.questions) ? d.questions : Array.isArray(d) ? d : []
    return arr
  },

  async createWithQuestions(payload: {
    title: string
    description: string
    duration: number
    difficulty: 'easy' | 'medium' | 'hard'
    total_score: number
    questions: { question_id: number; score: number; order: number }[]
  }) {
    return api.post('/papers/create-with-questions', payload)
  },
}
