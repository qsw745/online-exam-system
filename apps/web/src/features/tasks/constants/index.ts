// src/features/tasks/constants/index.ts
import type { TaskStatus } from '@/shared/types/tasks'

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
