// src/features/tasks/components/StatusTag.tsx
import { Tag } from 'antd'
import React from 'react'

// 统一在本文件内定义映射，避免依赖丢失
export type TaskStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'

const STATUS_COLOR: Record<TaskStatus, string> = {
  draft: 'default',
  published: 'green',
  in_progress: 'orange',
  completed: 'blue',
  archived: 'gray',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  draft: '草稿',
  published: '已发布',
  in_progress: '进行中',
  completed: '已完成',
  archived: '已归档',
}

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const key = (status || 'draft') as TaskStatus
  const color = STATUS_COLOR[key] || 'default'
  const text = STATUS_LABEL[key] || status || '未知'
  return <Tag color={color}>{text}</Tag>
}

export default StatusTag
