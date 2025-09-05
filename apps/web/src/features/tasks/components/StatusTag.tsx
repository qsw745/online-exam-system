// features/tasks/components/StatusTag.tsx
import { Tag } from 'antd'
import React from 'react'
import { STATUS_COLOR, STATUS_LABEL } from '../constants'
import type { TaskStatus } from '../types'
export const StatusTag: React.FC<{ status: TaskStatus }> = ({ status }) => (
  <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status] || status}</Tag>
)
