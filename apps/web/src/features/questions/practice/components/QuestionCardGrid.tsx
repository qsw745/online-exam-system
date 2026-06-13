// src/features/questions/practice/components/QuestionCardGrid.tsx
import React from 'react'
import { Card, Col, Row, Space, Spin, Tag, Typography } from 'antd'
import { diffLabel as diffLbl, typeLabel as typeLbl } from '@/features/questions/browse/utils/labelMaps'

const { Text } = Typography

type Item = {
  id: string | number
  content?: string
  difficulty?: string
  question_type?: string
}

type Props = {
  loading?: boolean
  list: Item[]
  onCardClick: (index: number) => void
}

export default function QuestionCardGrid({ loading, list, onCardClick }: Props) {
  return (
    <Spin spinning={!!loading} tip="加载题目中...">
      <Row gutter={[12, 12]}>
        {list.map((q, idx) => (
          <Col key={q.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              onClick={() => onCardClick(idx)}
              style={{ height: 180, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
            >
              <Space direction="vertical" style={{ flex: 1 }}>
                <Space>
                  {q.question_type && <Tag color="blue">{(typeLbl as any)[q.question_type] || q.question_type}</Tag>}
                  {q.difficulty && (
                    <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                      {(diffLbl as any)[q.difficulty] || q.difficulty}
                    </Tag>
                  )}
                </Space>
                <div
                  style={{
                    color: '#555',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {q.content || `题目 #${q.id}`}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Spin>
  )
}
