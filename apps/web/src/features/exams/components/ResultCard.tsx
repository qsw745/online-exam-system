import { Card, Space, Tag, Typography, Button } from 'antd'
import { BookmarkPlus, Clock, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ResultItem } from '@/shared/api/endpoints/results'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text } = Typography

export type UiStatus = 'completed' | 'in_progress' | 'not_started'
const toUiStatus = (s: string): UiStatus => (s === 'submitted' || s === 'graded' ? 'completed' : (s as UiStatus))

type Props = {
  result: ResultItem
  statusLabel: (s: UiStatus) => string
  statusTagColor: (s: UiStatus) => 'success' | 'warning' | 'default'
  locale: 'zh-CN' | 'en-US'
}

export default function ResultCard({ result, statusLabel, statusTagColor, locale }: Props) {
  const navigate = useNavigate()
  const start = result.start_time ? formatDateTime(result.start_time) : '-'
  const uiStatus = toUiStatus(String(result.status))

  return (
    <Card
      hoverable
      role="button"
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/results/${result.id}`)}
      actions={[
        <Button
          key="view"
          type="link"
          onClick={e => {
            e.stopPropagation()
            navigate(`/results/${result.id}`)
          }}
          icon={<Eye style={{ width: 16, height: 16 }} />}
        >
          {translate('results.review')}</Button>,
      ]}
    >
      <Card.Meta
        title={<span style={{ color: 'inherit' }}>{result.paper_title}</span>}
        description={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space>
              <BookmarkPlus style={{ width: 16, height: 16 }} />
              <Text type="secondary">
                {translate('auto.a49689d93f')}{result.score} / {result.total_score}
              </Text>
            </Space>
            <Space>
              <Clock style={{ width: 16, height: 16 }} />
              <Text type="secondary">{translate('auto.c4ac0ed36a')}{start}</Text>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Tag color={statusTagColor(uiStatus)}>{statusLabel(uiStatus)}</Tag>
            </div>
          </Space>
        }
      />
    </Card>
  )
}
