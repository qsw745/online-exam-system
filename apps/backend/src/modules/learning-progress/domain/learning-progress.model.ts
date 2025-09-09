import type { RowDataPacket } from 'mysql2/promise'

export interface LearningProgress extends RowDataPacket {
  id: number
  user_id: number
  subject_id?: number | null
  study_date: string
  time_spent: number
  total_questions: number
  correct_answers: number
  accuracy_rate: number
  created_at: string
  updated_at: string
}

export interface LearningGoal extends RowDataPacket {
  id: number
  user_id: number
  goal_type: string
  target_value: number
  current_value: number
  start_date: string
  end_date: string
  status: string
  subject_id?: number | null
  description?: string | null
  created_at: string
  updated_at: string
}

export interface LearningTrack extends RowDataPacket {
  id: number
  user_id: number
  activity_type: string
  activity_data: string
  subject_id?: number | null
  created_at: string
}

export interface LearningStatistics extends RowDataPacket {
  id: number
  user_id: number
  subject_id?: number | null
  stat_date: string
  total_study_time: number
  total_questions: number
  correct_questions: number
  accuracy_rate: number
  study_streak: number
  created_at: string
  updated_at: string
}

export interface LearningAchievement extends RowDataPacket {
  id: number
  user_id: number
  achievement_type: string
  achievement_name: string
  achievement_description: string
  achievement_data: string
  unlocked_at: string
}

export type ProgressStats = {
  dailyStats: Array<{
    date: string
    total_study_time: number
    total_questions: number
    correct_answers: number
    avg_accuracy: number
  }>
  totalStats: {
    total_study_time: number
    total_questions: number
    correct_answers: number
    avg_accuracy: number
    study_days: number
  }
  period: string
}

export type LearningReport = {
  period: string
  statistics: {
    total_study_time: number
    total_questions: number
    correct_questions: number
    avg_accuracy: number
    max_streak: number
    study_days: number
  }
  goals: { total_goals: number; completed_goals: number; in_progress_goals: number }
  achievements: { total_achievements: number }
  generatedAt: string
}

export type ProgressRecord = {
  id: number
  user_id: number
  subject_id: number
  subject: number | null
  questions_count: number
  correct_count: number
  study_time: number
  accuracy_rate: number
  created_at: string
}

export type Subject = { id: number; name: string }

export type LearningProgressData = {
  userId: number
  subjectId?: number
  studyTime: number
  questionsAnswered: number
  correctAnswers: number
  studyContent?: string
}

export type LearningGoalData = {
  userId: number
  goalType: string
  targetValue: number
  startDate: string
  endDate: string
  subjectId?: number
  description?: string
}
