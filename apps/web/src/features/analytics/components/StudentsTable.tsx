import { Card, Pagination, Progress, Table } from 'antd'
import dayjs from '@shared/utils/dayjs'
import React, { useMemo } from 'react'
import type { StudentRow } from '../types'
import { createPaginationConfig } from '@shared/constants/pagination'
import { formatStudyTime, getScoreColor } from '../utils'

type Props = {
  data: StudentRow[]
  total: number
  current: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (c: number, size: number) => void
}

export const StudentsTable: React.FC<Props> = ({ data, total, current, pageSize, onPageChange, onPageSizeChange }) => {
  const columns = useMemo(
    () => [
      {
        title: '学生',
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
        title: '平均分',
        dataIndex: 'avg_score',
        key: 'avg_score',
        sorter: (a: any, b: any) => b.avg_score - a.avg_score,
        render: (score: number) => (
          <div className="text-center">
            <div className="font-bold" style={{ color: getScoreColor(score) }}>
              {score.toFixed(1)}
            </div>
            <Progress
              percent={Math.max(0, Math.min(100, score))}
              size="small"
              strokeColor={getScoreColor(score)}
              showInfo={false}
            />
          </div>
        ),
      },
      {
        title: '完成考试',
        dataIndex: 'exams_completed',
        key: 'exams_completed',
        sorter: (a: any, b: any) => b.exams_completed - a.exams_completed,
        render: (n: number) => <div className="text-center font-medium">{n}</div>,
      },
      {
        title: '总分',
        dataIndex: 'total_score',
        key: 'total_score',
        sorter: (a: any, b: any) => b.total_score - a.total_score,
        render: (s: number) => <div className="text-center font-medium">{s.toFixed(1)}</div>,
      },
      {
        title: '学习时长',
        dataIndex: 'study_time',
        key: 'study_time',
        sorter: (a: any, b: any) => b.study_time - a.study_time,
        render: (m: number) => <div className="text-center">{formatStudyTime(m)}</div>,
      },
      {
        title: '最后活跃',
        dataIndex: 'last_active',
        key: 'last_active',
        render: (t: string) => <div className="text-sm text-gray-600">{dayjs(t).format('MM-DD HH:mm')}</div>,
      },
    ],
    []
  )

  return (
    <Card title="学生表现">
      <Table columns={columns as any} dataSource={data || []} rowKey="user_id" pagination={false} size="small" />
      <Pagination
        current={current}
        total={total}
        pageSize={pageSize}
        onChange={onPageChange}
        onShowSizeChange={onPageSizeChange}
        {...createPaginationConfig()}
      />
    </Card>
  )
}
