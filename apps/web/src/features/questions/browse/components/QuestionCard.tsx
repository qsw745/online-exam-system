// components/QuestionCard.tsx
import { BookmarkPlus, Clock, Eye, Heart } from 'lucide-react'
import { Button, Card, Space, Tag, Typography } from 'antd'
import React from 'react'
import { Link } from 'react-router-dom'
import { diffColor, diffLabelKey, typeColor, typeLabelKey } from '../utils/labelMaps'
import type { Question } from '@/shared/api/endpoints/questions'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
  // ==== 兼容字段 ====
  const id = String((q as any).id)
  const content: string = (q as any).content ?? (q as any).title ?? (q as any).stem ?? (q as any).question ?? ''
  const createdAt: string | undefined =
    (q as any).created_at ?? (q as any).createdAt ?? (q as any).create_time ?? (q as any).createdTime
  const kpOne = (q as any).knowledge_point
  const kpArr = (q as any).knowledge_points
  const knowledge: string = Array.isArray(kpArr) ? kpArr.join('、') : kpOne ?? ''
  const qType: string = (q as any).type ?? (q as any).question_type ?? 'unknown'
  const diff: string = (q as any).difficulty ?? (q as any).level ?? 'unknown'

  return (
    <Card
      hoverable
      actions={[
        <Link to={`/questions/${id}/practice`} key="view">
          <Space>
            <Eye size={16} />
            <span>{translate('workflow.btn_view')}</span>
          </Space>
        </Link>,
      ]}
    >
      <Space align="start" style={{ width: '100%' }}>
        <div style={{ flex: 1 }}>
          <div style={{ minHeight: 48, marginBottom: 8 }}>
            <Paragraph style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4 }} ellipsis={{ rows: 2 }}>
              <Link to={`/questions/${id}/practice`} style={{ color: 'inherit' }}>
                {content}
              </Link>
            </Paragraph>
          </div>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {!!knowledge && (
              <Space>
                <BookmarkPlus size={16} />
                <Text type="secondary">{knowledge}</Text>
              </Space>
            )}
            {!!createdAt && (
              <Space>
                <Clock size={16} />
                <Text type="secondary">{formatDateTime(createdAt)}</Text>
              </Space>
            )}
          </Space>
        </div>
        <Button
          type="text"
          icon={
            <Heart size={20} color={isFavorited ? '#ff4d4f' : '#d9d9d9'} fill={isFavorited ? 'currentColor' : 'none'} />
          }
          onClick={() => onFavorite(id, content.slice(0, 80))}
        />
      </Space>

      <div style={{ marginTop: 16 }}>
        <Space>
          <Tag color={typeColor[qType] || 'default'}>{typeLabelKey[qType] ? translate(typeLabelKey[qType]) : qType}</Tag>
          <Tag color={diffColor[diff] || 'default'}>{diffLabelKey[diff] ? translate(diffLabelKey[diff]) : diff}</Tag>
        </Space>
      </div>
    </Card>
  )
}
