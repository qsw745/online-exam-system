import { Card, Space, Tag, Typography } from 'antd'
import { BookmarkPlus, Clock, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ResultItem } from '@/shared/api/endpoints/results'

const { Text } = Typography

type Props = {
  result: ResultItem
  statusLabel: (s: string) => string
  statusTagColor: (s: string) => 'success' | 'warning' | 'default'
  locale: 'zh-CN' | 'en-US'
}

export default function ResultCard({ result, statusLabel, statusTagColor, locale }: Props) {
  const start = result.start_time ? new Date(result.start_time).toLocaleString(locale) : '-'
  return (
    <Card
      hoverable
      actions={[
        <Link to={`/results/${result.id}`} key="view">
          <Space>
            <Eye style={{ width: 16, height: 16 }} />
            <span>查看详情</span>
          </Space>
        </Link>,
      ]}
    >
      <Card.Meta
        title={
          <Link to={`/results/${result.id}`} style={{ color: 'inherit' }}>
            {result.paper_title}
          </Link>
        }
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
              {/* ✅ 将 submitted/graded 也视为“已完成” */}
              <Tag color={statusTagColor(mapToUiStatus(result.status))}>
                {statusLabel(mapToUiStatus(result.status))}
              </Tag>
            </div>
          </Space>
        }
      />
    </Card>
  )
}

function mapToUiStatus(s: string) {
  if (s === 'submitted' || s === 'graded') return 'completed'
  return s
}
