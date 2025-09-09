// components/QuestionCard.tsx
import { BookmarkPlus, Clock, Eye, Heart } from 'lucide-react'
import { Button, Card, Space, Tag, Typography } from 'antd'
import React from 'react'
import { Link } from 'react-router-dom'
import { diffColor, diffLabel, typeColor, typeLabel } from '../utils/labelMaps'
import type { Question } from '@/shared/api/endpoints/questions'

const { Paragraph, Text } = Typography

export function QuestionCard({
  q,
  isFavorited,
  onFavorite,
}: {
  q: Question
  isFavorited: boolean
  onFavorite: (id: string, title?: string) => void
}) {
  return (
    <Card
      hoverable
      actions={[
        <Link to={`/questions/${q.id}/practice`} key="view">
          <Space>
            <Eye size={16} />
            <span>查看</span>
          </Space>
        </Link>,
      ]}
    >
      <Space align="start" style={{ width: '100%' }}>
        <div style={{ flex: 1 }}>
          <div style={{ minHeight: 48, marginBottom: 8 }}>
            <Paragraph style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4 }} ellipsis={{ rows: 2 }}>
              <Link to={`/questions/${q.id}/practice`} style={{ color: 'inherit' }}>
                {q.content}
              </Link>
            </Paragraph>
          </div>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space>
              <BookmarkPlus size={16} />
              <Text type="secondary">{q.knowledge_point}</Text>
            </Space>
            <Space>
              <Clock size={16} />
              <Text type="secondary">{new Date(q.created_at).toLocaleString('zh-CN')}</Text>
            </Space>
          </Space>
        </div>
        <Button
          type="text"
          icon={
            <Heart size={20} color={isFavorited ? '#ff4d4f' : '#d9d9d9'} fill={isFavorited ? 'currentColor' : 'none'} />
          }
          onClick={() => onFavorite(q.id, q.content.slice(0, 80))}
        />
      </Space>

      <div style={{ marginTop: 16 }}>
        <Space>
          <Tag color={typeColor[q.type] || 'default'}>{typeLabel[q.type] || q.type}</Tag>
          <Tag color={diffColor[q.difficulty] || 'default'}>{diffLabel[q.difficulty] || q.difficulty}</Tag>
        </Space>
      </div>
    </Card>
  )
}
