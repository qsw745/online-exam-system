// features/questions/practice/components/KnowledgePointsCard.tsx
import { Card, Space, Tag, Typography } from 'antd'
import React from 'react'
import { translate } from '@/shared/utils/i18n'
const { Title } = Typography
export function KnowledgePointsCard({ points }: { points: string[] }) {
  if (!points?.length) return null
  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0 }}>
          {translate('auto.8e00a85a37')}</Title>
      }
    >
      <Space wrap>
        {points.map((p, i) => (
          <Tag key={i}>{p}</Tag>
        ))}
      </Space>
    </Card>
  )
}
