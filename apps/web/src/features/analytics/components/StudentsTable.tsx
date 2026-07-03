// apps/web/src/features/analytics/components/StudentsTable.tsx
import { Card, Progress, Table } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import React, { useMemo } from 'react'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

// ==== 本地最小类型与工具，去除对 ../types 与 ../utils 的依赖 ====
export type StudentRow = {
  user_id: number | string
  username: string
  avg_score: number
  exams_completed: number
  total_score: number
  study_time: number // 单位：分钟
  last_active: string // ISO 时间
}

const getScoreColor = (score: number) => {
  if (score >= 85) return '#52c41a' // 绿色
  if (score >= 60) return '#faad14' // 橙色
  return '#ff4d4f' // 红色
}

const formatStudyTime = (minutes: number) => {
  const m = Math.max(0, Math.floor(minutes || 0))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h === 0) return `${mm}${translate('time.minute')}`
  return `${h}${translate('time.hour')}${mm}${translate('time.minute')}`
}

// ==== 组件 ====
type Props = {
  data: StudentRow[]
  total: number
  current: number
  pageSize: number
  onPageChange: (p: number, pageSize: number) => void
}

export const StudentsTable: React.FC<Props> = ({ data, total, current, pageSize, onPageChange }) => {
  const { t } = useLanguage()
  const columns = useMemo(
    () => [
      {
        title: t('analytics.col_student'),
        dataIndex: 'username',
        key: 'username',
        render: (username: string, r: StudentRow) => (
          <div>
            <div className="font-medium">{username}</div>
            <div className="text-xs text-gray-500">ID: {r.user_id}</div>
          </div>
        ),
      },
      {
        title: t('analytics.avg_score'),
        dataIndex: 'avg_score',
        key: 'avg_score',
        sorter: (a: any, b: any) => b.avg_score - a.avg_score,
        render: (score: number) => (
          <div className="text-center">
            <div className="font-bold" style={{ color: getScoreColor(score) }}>
              {Number.isFinite(score) ? score.toFixed(1) : '-'}
            </div>
            <Progress
              percent={Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0))}
              size="small"
              strokeColor={getScoreColor(score || 0)}
              showInfo={false}
            />
          </div>
        ),
      },
      {
        title: t('analytics.col_completed_exams'),
        dataIndex: 'exams_completed',
        key: 'exams_completed',
        sorter: (a: any, b: any) => b.exams_completed - a.exams_completed,
        render: (n: number) => <div className="text-center font-medium">{n}</div>,
      },
      {
        title: t('analytics.col_total_score'),
        dataIndex: 'total_score',
        key: 'total_score',
        sorter: (a: any, b: any) => b.total_score - a.total_score,
        render: (s: number) => <div className="text-center font-medium">{Number.isFinite(s) ? s.toFixed(1) : '-'}</div>,
      },
      {
        title: t('analytics.col_study_time'),
        dataIndex: 'study_time',
        key: 'study_time',
        sorter: (a: any, b: any) => b.study_time - a.study_time,
        render: (m: number) => <div className="text-center">{formatStudyTime(m)}</div>,
      },
      {
        title: t('analytics.col_last_active'),
        dataIndex: 'last_active',
        key: 'last_active',
        render: (val: string) => <div className="text-sm text-gray-600">{val ? formatDateTime(val) : '-'}</div>,
      },
    ],
    [t]
  )

  return (
    <Card title={t('analytics.student_performance')}>
      <Table
        columns={columns as any}
        dataSource={Array.isArray(data) ? data : []}
        rowKey="user_id"
        pagination={false}
        size="small"
      />
      <GlobalPagination
        current={current}
        total={total}
        pageSize={pageSize}
        onChange={onPageChange}
      />
    </Card>
  )
}
