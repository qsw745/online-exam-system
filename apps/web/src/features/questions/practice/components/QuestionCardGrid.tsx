// src/features/questions/practice/components/QuestionCardGrid.tsx
import React from 'react'
import { Card, Col, Row, Space, Spin, Tag, Typography } from 'antd'
import { diffLabelKey, typeLabelKey } from '@/features/questions/browse/utils/labelMaps'
import { translate } from '@/shared/utils/i18n'

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
    <Spin spinning={!!loading} tip={translate('questions.loading')}>
      <Row gutter={[12, 12]}>
        {list.map((q, idx) => (
          <Col key={q.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              className="practice-question-card"
              hoverable
              role="button"
              tabIndex={loading ? -1 : 0}
              aria-disabled={loading}
              aria-label={`练习题目 ${idx + 1}`}
              onKeyDown={event => {
                if (!loading && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onCardClick(idx) }
              }}
              onClick={() => { if (!loading) onCardClick(idx) }}
              style={{ height: 180, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
            >
              <Space direction="vertical" style={{ flex: 1 }}>
                <Space>
                  {q.question_type && <Tag color="blue">{typeLabelKey[q.question_type] ? translate(typeLabelKey[q.question_type]) : q.question_type}</Tag>}
                  {q.difficulty && (
                    <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                      {diffLabelKey[q.difficulty] ? translate(diffLabelKey[q.difficulty]) : q.difficulty}
                    </Tag>
                  )}
                </Space>
                <div
                  style={{
                    color: 'var(--ant-color-text-secondary)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {q.content || `${translate('questions.item_fallback')} #${q.id}`}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Spin>
  )
}
