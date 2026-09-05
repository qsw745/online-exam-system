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
  busy?: boolean
  onView: (id: number) => void
  onMark: (id: number) => void
  onRemove: (id: number) => void
}> = ({ item, busy, onView, onMark, onRemove }) => (
  <Card className="student-wrong-item">
    <div className="student-wrong-item__layout" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color="blue">{getLabel(item.question_type)}</Tag>
          <Tag color={item.is_mastered ? 'green' : 'red'}>{item.is_mastered ? translate('profile.mastered') : translate('auto.74cb412b30')}</Tag>
        </Space>
        <div style={{ marginBottom: 12, color: 'var(--ant-color-text)' , lineHeight: 1.5 }}>{item.content}</div>
        <Space wrap size="middle">
          <Text type="secondary">{translate('auto.ba37b0a837')}{item.wrong_count}</Text>
          <Text type="secondary">{translate('auto.ad7a711510')}{item.correct_count}</Text>
          <Text type="secondary">{translate('auto.15d73d3b5d')}{fmtDate(item.last_practice_time)}</Text>
        </Space>
      </div>
      <Space className="student-wrong-item__actions">
        <Button
          type="text"
          icon={<Eye style={{ width: 20, height: 20 }} />}
          onClick={() => onView(item.question_id)}
          aria-label={translate('questions.page_view')}
          title={translate('questions.page_view')}
        />
        {!item.is_mastered && (
          <Button
            type="text"
            icon={<CheckCircle style={{ width: 20, height: 20, color: '#52c41a' }} />}
            disabled={busy}
            loading={busy}
            onClick={() => onMark(item.question_id)}
            aria-label={translate('auto.7c49dec9af')}
            title={translate('auto.7c49dec9af')}
          />
        )}
        <Button
          type="text"
          danger
          icon={<Trash2 style={{ width: 20, height: 20 }} />}
          disabled={busy}
          onClick={() => onRemove(item.question_id)}
          aria-label={translate('auto.f04bc41a8d')}
          title={translate('auto.f04bc41a8d')}
        />
      </Space>
    </div>
  </Card>
)
