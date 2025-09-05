// features/questions/types/question.ts
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'

export interface OptionDTO {
  content: string
  is_correct?: boolean
}
export interface QuestionDTO {
  id?: string
  content: string
  question_type: QuestionType
  options?: OptionDTO[]
  correct_answer?: number[] | string // 服务端可能返回索引数组或字符串
  explanation?: string
  knowledge_points?: string[]
  tags?: string[] | string
  score?: number
}
