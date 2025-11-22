// apps/backend/src/modules/tasks/domain/task.model.ts
import type { RowDataPacket } from 'mysql2/promise'

export type TaskType = 'exam' | 'practice'

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'published' | 'unpublished' | 'draft'

export interface TaskDTO extends RowDataPacket {
  id: number
  user_id: number
  title: string
  description: string | null
  type: TaskType
  status: TaskStatus
  start_time: Date | null
  end_time: Date | null
  exam_id: number | null
  created_at: Date
  updated_at: Date
  /** 来自聚合字段，仅查询时有值 */
  assigned_users_info?: string
}

export interface AssignedUser {
  id: number
  username: string
  email: string
}

export interface TaskWithAssigned extends TaskDTO {
  assigned_users?: AssignedUser[]
}

export interface TaskListQuery {
  page: number
  limit: number
  search?: string
  status?: TaskStatus | ''
  userRole: 'admin' | 'teacher' | 'student'
  userId: number
  startFrom?: string
  endTo?: string
}

export interface TaskListResult {
  tasks: TaskWithAssigned[]
  total: number
  page: number
  limit: number
}

export interface CreateTaskInput {
  creatorId: number
  title: string
  description?: string
  status?: TaskStatus
  start_time?: string | Date
  end_time?: string | Date
  exam_id?: number
  type?: TaskType
  assigned_user_ids?: number[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  start_time?: string | Date
  end_time?: string | Date
}
