// features/tasks/components/AssignedUsersCell.tsx
import { Space, Tag, Typography } from 'antd'
import React from 'react'
import type { AssignedUser } from '../types'
const { Text } = Typography
export const AssignedUsersCell: React.FC<{ users?: AssignedUser[] }> = ({ users }) => {
  if (!users || users.length === 0) {
    return (
      <Space direction="vertical" size={2}>
        <Text>未知用户</Text>
        <Text type="secondary">—</Text>
      </Space>
    )
  }
  const [first, ...rest] = users
  return (
    <Space direction="vertical" size={2}>
      <Text>{first.username}</Text>
      <Text type="secondary">{first.email}</Text>
      {rest.length > 0 && <Tag>等 {rest.length + 1} 人</Tag>}
    </Space>
  )
}
