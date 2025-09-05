export interface Task {
  id: string
  title: string
  type: 'exam' | 'practice' | string
  status: 'not_started' | 'in_progress' | 'completed' | 'expired' | string
  start_time: string
  end_time?: string
}

export interface Result {
  id: string
  paper_title: string
  score: number
  total_score: number
  created_at: string
}

export interface Stats {
  total_tasks: number
  completed_tasks: number
  average_score: number
  best_score: number
}
