// src/features/exams/types.ts
export type OptionItem = string | { content: string }
export type QuestionType = 'single' | 'multiple' | 'true_false' | 'short_answer'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Question {
  id: string
  content: string
  options: OptionItem[]
  type: QuestionType
  difficulty: Difficulty
  knowledge_points: string[]
}

export interface ExamPaper {
  id: string
  title: string
  description: string
  duration: number
  total_score: number
  questions: Question[]
}
