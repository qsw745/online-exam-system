import type { RowDataPacket } from 'mysql2'

export interface IOverview extends RowDataPacket {
  totalUsers: number
  activeUsers: number
  totalSubmissions: number
  averageScore: number
}

export interface IKnowledgePoint extends RowDataPacket {
  id: string
  name: string
  correctRate: number
  questionCount: number
}

export interface IDifficultyData extends RowDataPacket {
  difficulty: string
  count: number
  correctRate: number
}

export interface IActivityData extends RowDataPacket {
  date: string
  count: number
}
