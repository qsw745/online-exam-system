// features/questions/practice/components/ExplanationCard.tsx
import { Card, Typography } from 'antd'
import React from 'react'
const { Title, Text } = Typography
export function ExplanationCard({ text }: { text?: string }) {
  if (!text) return null
  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
          题目解析
        </Title>
      }
      style={{ background: '#f0f5ff', borderColor: '#91caff' }}
    >
      <Text style={{ color: '#1890ff', lineHeight: 1.6 }}>{text}</Text>
    </Card>
  )
}
