// apps/web/src/features/analytics/components/GradeTable.tsx
import React, { useMemo } from 'react'
import { Button, Space, Table, Tag, Typography } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { StudentResult } from '@/shared/types/grades'
import dayjs from '@/shared/utils/dayjs'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type Props = {
  results: StudentResult[]
  statusTagColor: (s: string) => 'default' | 'processing' | 'success' | 'warning' | 'error'
  statusLabel: (s: string) => string
  scoreTextType: (p?: number) => 'success' | 'warning' | 'danger' | undefined
  onView?: (r: StudentResult) => void
  loading?: boolean
}

const { Text } = Typography

export const GradeTable: React.FC<Props> = ({
  results,
  statusTagColor,
  statusLabel,
  scoreTextType,
  onView,
  loading,
}) => {
  const columns: ColumnsType<StudentResult> = useMemo(
    () => [
      {
        title: translate('auto.7f77243a0b'),
        key: 'student',
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            <Text strong>{r.student_name || translate('visible.24b1d68f6d')}</Text>
            <Text type="secondary">{r.student_email}</Text>
          </Space>
        ),
      },
      { title: translate('papers.col_paper'), dataIndex: 'paper_title', ellipsis: true },
      {
        title: translate('nav.results'),
        key: 'score',
        render: (_, r) => {
          const pct =
            typeof r.percentage === 'number'
              ? r.percentage
              : r.total_score
              ? (r.score / r.total_score) * 100
              : undefined
          return (
            <Space direction="vertical" size={0}>
              <Text strong type={scoreTextType(pct)}>
                {r.score}/{r.total_score}
              </Text>
              <Text type="secondary">{pct != null ? pct.toFixed(1) + '%' : '-'}</Text>
            </Space>
          )
        },
      },
      {
        title: translate('results.time_spent'),
        key: 'duration',
        width: 120,
        render: (_, r) => (r.duration ? `${Math.floor(r.duration / 60)}分${r.duration % 60}秒` : '-'),
      },
      {
        title: translate('users.columns.status'),
        dataIndex: 'status',
        width: 120,
        render: (s: string) => <Tag color={statusTagColor(s)}>{statusLabel(s)}</Tag>,
      },
      {
        title: translate('dashboard.submit_time'),
        dataIndex: 'created_at',
        width: 200,
        render: (v: string) => (v ? formatDateTime(v) : '-'),
      },
      {
        title: translate('users.columns.actions'),
        key: 'action',
        width: 120,
        render: (_, r) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => onView?.(r)}>
            {translate('results.review')}</Button>
        ),
      },
    ],
    [onView, scoreTextType, statusLabel, statusTagColor]
  )

  return (
    <Table<StudentResult>
      rowKey={r => String(r.id)}
      columns={columns}
      dataSource={results}
      loading={loading}
      pagination={false}
      size="middle"
    />
  )
}
