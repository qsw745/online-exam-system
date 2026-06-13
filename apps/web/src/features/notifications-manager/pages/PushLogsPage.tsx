import { Card, Table, Tag } from 'antd'
import React, { useMemo } from 'react'

type Log = {
  id: number
  channel: 'site' | 'email' | 'sms' | 'webhook'
  target: string
  status: 'success' | 'failed'
  message?: string
  created_at: string
}

export default function PushLogsPage() {
  const data = useMemo<Log[]>(
    () => [
      { id: 1, channel: 'email', target: 'alice@example.com', status: 'success', created_at: '2025-01-05 09:30' },
      {
        id: 2,
        channel: 'sms',
        target: '138****0001',
        status: 'failed',
        message: '供应商限流',
        created_at: '2025-01-05 09:35',
      },
    ],
    []
  )

  return (
    <Card title="推送日志">
      <Table
        rowKey="id"
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '渠道', dataIndex: 'channel', width: 120, render: v => <Tag>{String(v).toUpperCase()}</Tag> },
          { title: '目标', dataIndex: 'target' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (v: Log['status']) =>
              v === 'success' ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
          },
          { title: '错误信息', dataIndex: 'message' },
          { title: '时间', dataIndex: 'created_at', width: 200 },
        ]}
      />
    </Card>
  )
}
