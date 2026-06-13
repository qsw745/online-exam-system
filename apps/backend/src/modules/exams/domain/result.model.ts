import type { RowDataPacket } from 'mysql2'

export interface IResult extends RowDataPacket {
  id: number
  user_id: number
  exam_id?: number | null
  paper_id: number | null
  paper_title?: string
  score: number
  total_score?: number
  answers?: string | null
  start_time: Date | null
  end_time: Date | null
  status: string
  created_at: Date
  updated_at: Date
  duration?: number | null
  percentage?: number | null
}

export type ResultListData = {
  results: IResult[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type QuestionResultRow = {
  id: number
  type: string
  content: string
  options: string[] | null
  score: number
  order: number
  user_answer: string | null
  correct_answer: string | null
  is_correct: 0 | 1 | null
}

export type ResultDetail = IResult & {
  questions: QuestionResultRow[]
}
