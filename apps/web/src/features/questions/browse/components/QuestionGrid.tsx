// components/QuestionGrid.tsx
import { Col, Empty, Row, Space, Typography } from 'antd'
import React from 'react'
import { BookmarkPlus } from 'lucide-react'
import type { Question } from '../types/question'
import { QuestionCard } from './QuestionCard'

const { Text } = Typography

export function QuestionGrid({
  items,
  favorites,
  onFavorite,
}: {
  items: Question[]
  favorites: Set<string>
  onFavorite: (id: string, title?: string) => void
}) {
  if (!items.length) {
    return (
      <Empty
        image={<BookmarkPlus width={48} height={48} color="#d9d9d9" />}
        description={
          <Space direction="vertical">
            <Text strong>暂无题目</Text>
            <Text type="secondary">当前筛选条件下没有找到任何题目</Text>
          </Space>
        }
      />
    )
  }
  return (
    <Row gutter={[16, 16]}>
      {items.map(q => (
        <Col key={q.id} xs={24} md={12} lg={8}>
          <QuestionCard q={q} isFavorited={favorites.has(q.id)} onFavorite={onFavorite} />
        </Col>
      ))}
    </Row>
  )
}
