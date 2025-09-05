// components/PageHeader.tsx
import { Button, Space, Typography } from 'antd'
import { Play } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
const { Title, Text } = Typography

export function PageHeader({
  viewType,
  title,
  desc,
  isAdmin,
  manageHref,
  practiceHref,
}: {
  viewType: string
  title: string
  desc: string
  isAdmin: boolean
  manageHref: string
  practiceHref?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Title level={2} style={{ margin: 0 }}>
          {title}
        </Title>
        <Text type="secondary">{desc}</Text>
      </div>
      <Space>
        {isAdmin && (
          <Link to={manageHref}>
            <Button type="primary">去后台管理</Button>
          </Link>
        )}
        {viewType === 'all' && practiceHref && (
          <Link to={practiceHref}>
            <Button type="primary" icon={<Play size={16} />}>
              开始连续练习
            </Button>
          </Link>
        )}
      </Space>
    </div>
  )
}
