export type Period = '7d' | '30d' | '90d' | 'all'

export interface DataOverview {
  totalUsers: number
  activeUsers: number
  totalSubmissions: number
  averageScore: number
}

export interface KnowledgePoint {
  id: string
  name: string
  correctRate: number // 0~1
  questionCount: number
}

export interface DifficultyDatum {
  difficulty: 'easy' | 'medium' | 'hard' | string
  count: number
  correctRate: number // 0~1
}

export interface ActivityDatum {
  date: string
  submissions: number
  activeUsers: number
}
