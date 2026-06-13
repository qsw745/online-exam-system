import { Card, Progress, Table } from 'antd'
import React, { useMemo } from 'react'

export type SubjectRow = {
  subject: string
  questions_count: number
  avg_score: number
  completion_rate: number
}

const getScoreColor = (score: number): string => {
  if (score >= 85) return '#52c41a'
  if (score >= 60) return '#faad14'
  return '#ff4d4f'
}

export const SubjectsTable: React.FC<{ data: SubjectRow[] }> = ({ data }) => {
  const columns = useMemo(
    () => [
      {
        title: '科目',
        dataIndex: 'subject',
        key: 'subject',
        render: (s: string) => <div className="font-medium">{s}</div>,
      },
      {
        title: '题目数量',
        dataIndex: 'questions_count',
        key: 'questions_count',
        sorter: (a: any, b: any) => b.questions_count - a.questions_count,
        render: (n: number) => <div className="text-center font-medium">{n}</div>,
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
        title: '完成率',
        dataIndex: 'completion_rate',
        key: 'completion_rate',
        sorter: (a: any, b: any) => b.completion_rate - a.completion_rate,
        render: (rate: number) => (
          <div className="text-center">
            <div className="font-medium">{rate.toFixed(1)}%</div>
            <Progress
              percent={Math.max(0, Math.min(100, rate))}
              size="small"
              strokeColor={rate >= 80 ? '#52c41a' : rate >= 60 ? '#faad14' : '#ff4d4f'}
              showInfo={false}
            />
          </div>
        ),
      },
    ],
    []
  )

  return (
    <Card title="科目统计" className="mb-6">
      <Table columns={columns as any} dataSource={data || []} rowKey="subject" pagination={false} size="small" />
    </Card>
  )
}
