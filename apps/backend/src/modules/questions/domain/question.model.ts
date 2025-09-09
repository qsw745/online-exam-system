// apps/backend/src/modules/questions/domain/question.model.ts
import type { RowDataPacket } from 'mysql2/promise'

export interface IQuestion extends RowDataPacket {
  id: number
  title: string
  content: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
  difficulty: 'easy' | 'medium' | 'hard'
  options: any
  correct_answer: any
  knowledge_points: any
  tags: any
  explanation: string
  exam_id: number | null
  score: number
  created_at: Date
  updated_at: Date
}

export type QuestionData = { question: IQuestion }
export type QuestionListData = {
  questions: IQuestion[]
  pagination: { total: number; totalPages: number; currentPage: number; pageSize: number }
}
