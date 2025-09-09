// src/features/tasks/components/StatusTag.tsx
import React from 'react'
import { Tag } from 'antd'
import { STATUS_COLOR, STATUS_LABEL } from '../constants'
import type { TaskStatus } from '@/shared/types/tasks'

export interface StatusTagProps {
  status?: string | TaskStatus
  fallbackText?: string
}

const StatusTag: React.FC<StatusTagProps> = ({ status, fallbackText = '未知' }) => {
  const key = (status || 'not_started') as TaskStatus
  const color = (STATUS_COLOR as any)[key] || 'default'
  const text = (STATUS_LABEL as any)[key] || status || fallbackText
  return <Tag color={color}>{text}</Tag>
}

export default StatusTag
