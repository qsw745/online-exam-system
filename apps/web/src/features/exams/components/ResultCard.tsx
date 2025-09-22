import { Card, Space, Tag, Typography, Button } from 'antd'
import { BookmarkPlus, Clock, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ResultItem } from '@/shared/api/endpoints/results'

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
  const start = result.start_time ? new Date(result.start_time).toLocaleString(locale) : '-'
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
          查看详情
        </Button>,
      ]}
    >
      <Card.Meta
        title={<span style={{ color: 'inherit' }}>{result.paper_title}</span>}
        description={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space>
              <BookmarkPlus style={{ width: 16, height: 16 }} />
              <Text type="secondary">
                成绩: {result.score} / {result.total_score}
              </Text>
            </Space>
            <Space>
              <Clock style={{ width: 16, height: 16 }} />
              <Text type="secondary">开始时间: {start}</Text>
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
