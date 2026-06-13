// apps/backend/src/modules/exams/domain/exam.model.ts
import type { RowDataPacket } from 'mysql2'

export interface IExam extends RowDataPacket {
  id: number
  title: string
  description: string
  duration: number
  start_time: Date | null
  end_time: Date | null
  total_score: number
  passing_score: number
  created_by: number
  status: 'draft' | 'reviewing' | 'approved' | 'published' | 'closed' | 'rejected' // ← 不再可选
  created_at: Date
  updated_at: Date
  workflow_requires_review: 0 | 1
  workflow_template_id?: number | null
  workflow_form_data?: string | null
}

export interface IQuestionRow extends RowDataPacket {
  id: number
  title: string
  content: string
  type: string
  score: number
  options?: string | null
}

export type ExamListData = {
  exams: IExam[]
  total: number
  page: number
  limit: number
}

export type ExamDetailData = {
  exam: IExam
  questions: Array<{ id: number; title: string; content: string; type: string; score: number; options?: string }>
}
