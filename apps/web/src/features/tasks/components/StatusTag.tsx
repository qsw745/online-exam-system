// src/features/tasks/components/StatusTag.tsx
import React from 'react'
import { Tag } from 'antd'
import { getTaskStatusColor, getTaskStatusLabel } from '../constants/taskStatus'

const StatusTag: React.FC<{ status?: string }> = ({ status }) => {
  const color = getTaskStatusColor(status)
  const text = getTaskStatusLabel(status)
  return <Tag color={color === 'default' ? undefined : color}>{text}</Tag>
}

export default StatusTag
