// features/tasks/types/index.ts
export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'pending'
  | 'published'
  | 'unpublished'

export interface AssignedUser {
  id: number
  username: string
  email: string
}

export interface Task {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  status: TaskStatus
  type?: 'exam' | 'practice'
  exam_id?: number
  created_at: string
  updated_at: string
  assigned_users?: AssignedUser[]
}

// features/tasks/constants/index.ts
import type { TaskStatus } from '../types'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: '待开始',
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  expired: '已过期',
  published: '已发布',
  unpublished: '已下线',
}

export const STATUS_COLOR: Record<TaskStatus, 'default' | 'processing' | 'success' | 'error' | 'warning'> = {
  not_started: 'default',
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  expired: 'error',
  published: 'processing',
  unpublished: 'warning',
}
