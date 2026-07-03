import { Button, Card, Space, Tag, Typography } from 'antd'
import { CheckCircle, Eye, Trash2 } from 'lucide-react'
import React from 'react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text } = Typography

export type WrongQuestion = {
  id?: number
  question_id: number
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  is_mastered: boolean
  content: string
  wrong_count: number
  correct_count: number
  last_practice_time: string
}

const getLabel = (type: string) =>
  (({
    single_choice: translate('questions.single_choice'),
    multiple_choice: translate('questions.multiple_choice'),
    true_false: translate('questions.judge'),
    short_answer: translate('questions.type_short'),
  } as any)[type] || type)

const fmtDate = (s: string) => {
  return formatDateTime(s) || '-'
}

export const WrongQuestionItem: React.FC<{
  item: WrongQuestion
  onView: (id: number) => void
  onMark: (id: number) => void
  onRemove: (id: number) => void
}> = ({ item, onView, onMark, onRemove }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <Space style={{ marginBottom: 12 }}>
          <Tag color="blue">{getLabel(item.question_type)}</Tag>
          <Tag color={item.is_mastered ? 'green' : 'red'}>{item.is_mastered ? translate('profile.mastered') : translate('auto.74cb412b30')}</Tag>
        </Space>
        <div style={{ marginBottom: 12, color: '#262626', lineHeight: 1.5 }}>{item.content}</div>
        <Space size="large">
          <Text type="secondary">{translate('auto.ba37b0a837')}{item.wrong_count}</Text>
          <Text type="secondary">{translate('auto.ad7a711510')}{item.correct_count}</Text>
          <Text type="secondary">{translate('auto.15d73d3b5d')}{fmtDate(item.last_practice_time)}</Text>
        </Space>
      </div>
      <Space style={{ marginLeft: 16 }}>
        <Button
          type="text"
          icon={<Eye style={{ width: 20, height: 20 }} />}
          onClick={() => onView(item.question_id)}
          title={translate('questions.page_view')}
        />
        {!item.is_mastered && (
          <Button
            type="text"
            icon={<CheckCircle style={{ width: 20, height: 20, color: '#52c41a' }} />}
            onClick={() => onMark(item.question_id)}
            title={translate('auto.7c49dec9af')}
          />
        )}
        <Button
          type="text"
          danger
          icon={<Trash2 style={{ width: 20, height: 20 }} />}
          onClick={() => onRemove(item.question_id)}
          title={translate('auto.f04bc41a8d')}
        />
      </Space>
    </div>
  </Card>
)
