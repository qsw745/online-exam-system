// src/features/exams/components/ExamCard.tsx

import React, { useState } from 'react'
import { Button, Card, Space, Tag, Typography } from 'antd'
import { BookOpen, Clock, Play, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import ExamWorkflowModal from '@/features/exams/components/ExamWorkflowModal'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'
const { Title, Paragraph } = Typography
// ✅ 本地最小化类型（避免从 http 导入不存在的类型）
type Exam = {
  id: string | number
  title: string
  status: 'draft' | 'reviewing' | 'approved' | 'published' | 'closed' | 'rejected' | 'archived' | (string & {})
  description?: string
  duration?: number | null
  total_score?: number | null
  question_count?: number
  participant_count?: number
  start_time?: string
  end_time?: string
  my_status?: 'in_progress' | 'completed' | 'submitted' | 'graded' | (string & {}) | null
  my_score?: number | null
  my_result_id?: string | number | null
  my_result_status?: string | null
  my_result_score?: number | null
}
function formatDuration(minutes?: number | null) {
  const safeMinutes = Number(minutes)
  if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return '-'
  const h = Math.floor(safeMinutes / 60)
  const m = safeMinutes % 60
  return h > 0
    ? `${h}${translate('time.hour')}${m > 0 ? `${m}${translate('time.minute')}` : ''}`
    : `${m}${translate('time.minute')}`
}
function StatusBadge({ status }: { status: Exam['status'] }) {
  const map = {
    draft: { label: translate('auto.0f436818c0'), color: 'default' as const },
    reviewing: { label: translate('auto.fe58c849a9'), color: 'warning' as const },
    approved: { label: translate('auto.3f3d8682dd'), color: 'processing' as const },
    published: { label: translate('auto.176a2eb4eb'), color: 'success' as const },
    closed: { label: translate('auto.f628761bf5'), color: 'default' as const },
    rejected: { label: translate('workflowTemplates.status.rejected'), color: 'error' as const },
    archived: { label: translate('auto.5cfbea2b76'), color: 'error' as const },
  }
  const cfg = map[status as keyof typeof map] ?? map.draft
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}
export function ExamCard({ exam }: { exam: Exam }) {
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const resultStatus = String(exam.my_result_status ?? exam.my_status ?? '').toLowerCase()
  const isDone = ['completed', 'submitted', 'graded'].includes(resultStatus)
  const isInProgress = resultStatus === 'in_progress'
  const resultScore = exam.my_result_score ?? exam.my_score
  const resultPath = exam.my_result_id != null ? `/results/${exam.my_result_id}` : '/results'
  return (
    <>
      <Card
        hoverable
        style={{ marginBottom: 16 }}
        actions={[
          exam.status === 'published' && isDone ? (
            <Link to={resultPath} key="result">
              <Button icon={<BookOpen className="w-4 h-4" />}>
                {translate('exam.view_result')}</Button>
            </Link>
          ) : exam.status === 'published' ? (
            <Link to={`/exam/${exam.id}`} key="start">
              <Button type="primary" icon={<Play className="w-4 h-4" />}>
                {isInProgress ? translate('exam.continue') : translate('exam.start')}</Button>
            </Link>
          ) : (
            <Button disabled key="disabled">
              {translate('auto.4dddd9200c')}</Button>
          ),
          ['draft', 'rejected'].includes(exam.status as string) && (
            <Button type="link" key="workflow" onClick={() => setWorkflowOpen(true)}>
              {translate('auto.25d9be0724')}</Button>
          ),
        ].filter(Boolean)}
      >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              {exam.title}
            </Title>
            <StatusBadge status={exam.status} />
            {isDone && (
              <Tag color="success">
                {translate('exam.my_done')}
                {resultScore != null ? ` · ${Number(resultScore)}${translate('papers.addon_score')}` : ''}
              </Tag>
            )}
            {isInProgress && <Tag color="warning">{translate('exam.my_in_progress')}</Tag>}
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
              <span>{exam.total_score ?? '-'}{translate('papers.addon_score')}</span>
            </Space>

            {typeof exam.question_count === 'number' && (
              <Space size="small">
                <span>{exam.question_count}{translate('papers.unit_question')}</span>
              </Space>
            )}

            {typeof exam.participant_count === 'number' && (
              <Space size="small">
                <Users className="w-4 h-4" />
                <span>{exam.participant_count}{translate('auto.83f6f4c890')}</span>
              </Space>
            )}
          </Space>

          {(exam.start_time || exam.end_time) && (
            <div style={{ marginTop: 12, fontSize: 14, color: '#8c8c8c' }}>
              {exam.start_time && <div>{translate('auto.c4ac0ed36a')}{formatDateTime(exam.start_time)}</div>}
              {exam.end_time && <div>{translate('auto.a931b9df4e')}{formatDateTime(exam.end_time)}</div>}
            </div>
          )}
        </div>
      </div>
      </Card>
      <ExamWorkflowModal
        examId={Number(exam.id)}
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
      />
    </>
  )
}
