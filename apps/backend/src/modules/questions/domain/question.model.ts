import type { RowDataPacket } from 'mysql2/promise'

// ====== 重复题分组返回 ======
export type DuplicateGroupKey = {
  title: string
  question_type: IQuestion['question_type']
  dup_count: number
}
export type DuplicateGroup = DuplicateGroupKey & {
  items: IQuestion[]
}
export type QuestionDupGroupListData = {
  grouped: true
  groups: DuplicateGroup[]
  pagination: {
    totalGroups: number
    totalPages: number
    currentPage: number
    pageSize: number
  }
}

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

  /** ↓↓↓ 仅“查重列表”用的窗口字段（不会入库）↓↓↓ */
  dup_total?: number // 该标题+题型下总重复数
  dup_index?: number // 当前条在该重复组中的序号（按created_at DESC）
  display_title?: string // 用于前端直接展示的标题（已带“重复标记”）
}

export type QuestionData = { question: IQuestion }
export type QuestionListData = {
  questions: IQuestion[]
  pagination: { total: number; totalPages: number; currentPage: number; pageSize: number }
}
