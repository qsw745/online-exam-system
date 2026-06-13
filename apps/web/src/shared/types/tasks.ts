// src/shared/types/tasks.ts

export type TaskStatus =
  | 'not_started'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'published'
  | 'unpublished'

export interface AssignedUser {
  id: number
  username: string
  email: string
}

export interface Task {
  id: string | number
  title: string
  description?: string
  start_time?: string // ISO string
  end_time?: string // ISO string
  status: TaskStatus
  type?: 'exam' | 'practice'
  exam_id?: number
  created_at?: string
  updated_at?: string
  assigned_users?: AssignedUser[]
}
