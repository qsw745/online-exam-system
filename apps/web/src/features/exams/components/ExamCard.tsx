// src/features/exams/components/ExamCard.tsx
import { Card, Button, Space, Typography, Tag } from 'antd'
import { BookOpen, Clock, Play, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Exam } from '@shared/api/endpoints/exams'
const { Title, Paragraph } = Typography

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}小时${m > 0 ? m + '分钟' : ''}` : `${m}分钟`
}
function StatusBadge({ status }: { status: Exam['status'] }) {
  const map = {
    draft: { label: '草稿', color: 'default' as const },
    published: { label: '已发布', color: 'success' as const },
    archived: { label: '已归档', color: 'error' as const },
  }
  const cfg = map[status] ?? map.draft
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}

export function ExamCard({ exam }: { exam: Exam }) {
  return (
    <Card
      hoverable
      style={{ marginBottom: 16 }}
      actions={[
        exam.status === 'published' ? (
          <Link to={`/exam/${exam.id}`} key="start">
            <Button type="primary" icon={<Play className="w-4 h-4" />}>
              开始考试
            </Button>
          </Link>
        ) : (
          <Button disabled key="disabled">
            暂不可用
          </Button>
        ),
      ]}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              {exam.title}
            </Title>
            <StatusBadge status={exam.status} />
          </div>

          {exam.description && (
            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 16, color: '#666' }}>
              {exam.description}
            </Paragraph>
          )}

          <Space size="large" style={{ color: '#8c8c8c' }}>
            <Space size="small">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(exam.duration)}</span>
            </Space>

            <Space size="small">
              <BookOpen className="w-4 h-4" />
              <span>{exam.total_score}分</span>
            </Space>

            {typeof exam.question_count === 'number' && (
              <Space size="small">
                <span>{exam.question_count}题</span>
              </Space>
            )}

            {typeof exam.participant_count === 'number' && (
              <Space size="small">
                <Users className="w-4 h-4" />
                <span>{exam.participant_count}人参加</span>
              </Space>
            )}
          </Space>

          {(exam.start_time || exam.end_time) && (
            <div style={{ marginTop: 12, fontSize: 14, color: '#8c8c8c' }}>
              {exam.start_time && <div>开始时间: {new Date(exam.start_time).toLocaleString()}</div>}
              {exam.end_time && <div>结束时间: {new Date(exam.end_time).toLocaleString()}</div>}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
