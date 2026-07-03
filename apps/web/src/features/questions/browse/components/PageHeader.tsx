// components/PageHeader.tsx
import { Button, Space, Typography } from 'antd'
import { Play } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'
const { Title, Text } = Typography

export function PageHeader({
  viewType,
  title,
  desc,
  practiceHref,
}: {
  viewType: string
  title: string
  desc: string
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
        {viewType === 'all' && practiceHref && (
          <Link to={practiceHref}>
            <Button type="primary" icon={<Play size={16} />}>
              {translate('auto.5cfb05d513')}</Button>
          </Link>
        )}
      </Space>
    </div>
  )
}
