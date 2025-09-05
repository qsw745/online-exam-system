export interface Overview {
  total_students: number
  total_questions: number
  total_exams: number
  avg_score: number
  completion_rate: number
  active_students: number
}

export interface TrendPoint {
  date: string
  students_count: number
  exams_count: number
  avg_score: number
}

export interface SubjectRow {
  subject: string
  questions_count: number
  avg_score: number
  completion_rate: number
}

export interface StudentRow {
  user_id: number
  username: string
  total_score: number
  exams_completed: number
  avg_score: number
  study_time: number // minutes
  last_active: string
}

export interface AnalyticsData {
  overview: Overview
  trends: TrendPoint[]
  subjects: SubjectRow[]
  students: StudentRow[]
}
