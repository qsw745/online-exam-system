import type { RowDataPacket } from 'mysql2/promise'

export interface Leaderboard extends RowDataPacket {
  id: number
  name: string
  description: string
  type: 'score' | 'time' | 'accuracy' | 'progress' | 'custom'
  category: 'global' | 'subject' | 'exam' | 'monthly' | 'weekly' | 'daily'
  subject_id?: number
  exam_id?: number
  calculation_method: any
  is_active: boolean
  start_date?: Date
  end_date?: Date
  created_by: number
  created_at: Date
  updated_at: Date
}

export interface LeaderboardRecord extends RowDataPacket {
  id: number
  leaderboard_id: number
  user_id: number
  score: number
  rank_position: number
  additional_data: any
  record_date: Date
  username?: string
  email?: string
  avatar?: string
}

export interface Competition extends RowDataPacket {
  id: number
  title: string
  description: string
  type: 'individual' | 'team'
  status: 'draft' | 'registration' | 'ongoing' | 'finished' | 'cancelled'
  registration_start?: Date
  registration_end?: Date
  competition_start?: Date
  competition_end?: Date
  max_participants?: number
  rules: any
  prizes: any
  created_by: number
  participant_count?: number
}
