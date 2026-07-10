import type { RowDataPacket } from 'mysql2/promise'

export type UserRole = 'admin' | 'teacher' | 'student'
export type UserStatus = 'active' | 'disabled'
export type GenderCN = '男' | '女' | '保密'

export interface UserDTO extends RowDataPacket {
  id: number
  username: string
  email: string | null
  role: UserRole
  nickname?: string | null
  school?: string | null
  class_name?: string | null
  experience_points: number
  level: number
  avatar_url?: string | null
  status: UserStatus
  // ✅ 新增字段
  phone?: string | null
  gender?: GenderCN | null
  remark?: string | null
  created_at: Date
  updated_at: Date
}

export interface UserSettings {
  notifications?: { email: boolean; push: boolean; sound: boolean }
  privacy?: { profile_visibility: 'public' | 'private'; show_activity: boolean; show_results: boolean }
  appearance?: { theme?: 'light' | 'dark'; language?: string }
  security?: {
    phone?: string
    backup_email?: string
    question?: string
    answer?: string
    questions?: Array<{ question: string; answer: string }>
  }
}
