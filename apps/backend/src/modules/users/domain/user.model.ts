// apps/backend/src/modules/users/domain/user.entity.ts
import type { RowDataPacket } from 'mysql2/promise'

export type UserRole = 'admin' | 'teacher' | 'student'
export type UserStatus = 'active' | 'disabled'

export interface UserDTO extends RowDataPacket {
  id: number
  username: string
  email: string
  role: UserRole
  nickname?: string | null
  school?: string | null
  class_name?: string | null
  experience_points: number
  level: number
  avatar_url?: string | null
  status: UserStatus
  created_at: Date
  updated_at: Date
}

export interface UserSettings {
  notifications?: { email: boolean; push: boolean; sound: boolean }
  privacy?: { profile_visibility: 'public' | 'private'; show_activity: boolean; show_results: boolean }
  appearance?: { theme?: 'light' | 'dark'; language?: string }
}
