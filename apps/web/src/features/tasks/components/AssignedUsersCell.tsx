// features/tasks/components/AssignedUsersCell.tsx
import { Space, Tag, Typography } from 'antd'
import React from 'react'
import type { AssignedUser } from '@/shared/types/index'
import { translate } from '@/shared/utils/i18n'
const { Text } = Typography
export const AssignedUsersCell: React.FC<{ users?: AssignedUser[] }> = ({ users }) => {
  if (!users || users.length === 0) {
    return (
      <Space direction="vertical" size={2}>
        <Text>{translate('auto.410959e641')}</Text>
        <Text type="secondary">—</Text>
      </Space>
    )
  }
  const [first, ...rest] = users
  return (
    <Space direction="vertical" size={2}>
      <Text>{first.username}</Text>
      <Text type="secondary">{first.email}</Text>
      {rest.length > 0 && <Tag>{translate('auto.3d3e17a162')}{rest.length + 1} {translate('auto.4912771a42')}</Tag>}
    </Space>
  )
}
