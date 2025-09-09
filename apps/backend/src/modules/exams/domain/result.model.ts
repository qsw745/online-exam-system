import type { RowDataPacket } from 'mysql2'

export interface IResult extends RowDataPacket {
  id: number
  user_id: number
  paper_id: number
  score: number
  answers?: string
  start_time: Date
  end_time: Date
  status: 'pending' | 'in_progress' | 'completed' | 'submitted'
  created_at: Date
  updated_at: Date
  paper_title?: string
  total_score?: number
}

export type ResultListData = {
  results: IResult[]
  pagination?: { page: number; limit: number; total: number; totalPages: number }
}
