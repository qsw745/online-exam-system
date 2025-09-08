export interface StudentResult {
  id: string
  student_id: string
  student_name: string
  student_email: string
  paper_id: string
  paper_title: string
  score: number
  total_score: number
  percentage: number
  start_time: string
  end_time: string
  duration: number
  status: 'completed' | 'in_progress' | 'not_started' | string
  created_at: string
}

export interface GradeStats {
  totalStudents: number
  totalExams: number
  averageScore: number
  passRate: number
}

export interface PaperLite {
  id: string
  title: string
}

export interface GradeQuery {
  searchTerm: string
  filterPaper: string // 'all' | paperId
  filterStatus: string // 'all' | 'completed' | ...
  page: number
  limit: number
}
