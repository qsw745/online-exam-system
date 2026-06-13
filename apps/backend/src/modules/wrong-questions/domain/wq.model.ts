// apps/backend/src/modules/wrong-questions/domain/wq.model.ts
export type MasteryLevel = 'not_mastered' | 'partially_mastered' | 'mastered'

export interface WrongQuestionBook {
  id?: number
  user_id: number
  name: string
  description?: string
  is_default: boolean
  is_public: boolean
  created_at?: string
  updated_at?: string
}

export interface WrongQuestion {
  id?: number
  /** ✅ 必须：与表结构一致 */
  user_id: number
  book_id: number
  question_id: number
  exam_result_id?: number
  wrong_count: number
  /** string | Date 皆可，Repo 中会统一转为 Date */
  last_wrong_time: string | Date
  mastery_level: MasteryLevel
  tags?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface PracticeRecord {
  id?: number
  user_id: number
  wrong_question_id: number
  is_correct: boolean
  time_spent: number
  practice_time: string | Date
  created_at?: string
}
