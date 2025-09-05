// features/questions/practice/types/question.ts
export type QType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'

export interface QuestionRaw {
  id: string
  content: string
  question_type: QType
  options?: Array<{ content: string; is_correct: boolean }>
  correct_answer?: number[] | string
  answer?: string
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledge_points?: string[]
}

export interface NormalizedQuestion {
  id: string
  content: string
  type: QType
  // 统一为选项数组；简答题可为空；判断题转成“正确/错误”
  options: Array<{ content: string }>
  // 统一：正确索引列表（单选/判断长度=1；多选>=1；简答为空）
  correctIndices: number[]
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  knowledgePoints: string[]
}
