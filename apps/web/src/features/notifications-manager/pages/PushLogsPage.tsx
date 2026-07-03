import { Card, Table, Tag } from 'antd'
import React, { useMemo } from 'react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
        message: translate('auto.846ef65a8b'),
        created_at: '2025-01-05 09:35',
      },
    ],
    []
  )

  return (
    <Card title={translate('menus.notify-log')}>
      <Table
        rowKey="id"
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: translate('auto.c152be9f50'), dataIndex: 'channel', width: 120, render: v => <Tag>{String(v).toUpperCase()}</Tag> },
          { title: translate('auto.941f08313a'), dataIndex: 'target' },
          {
            title: translate('users.columns.status'),
            dataIndex: 'status',
            width: 120,
            render: (v: Log['status']) =>
              v === 'success' ? <Tag color="green">{translate('auto.51991a5d11')}</Tag> : <Tag color="red">{translate('auto.3e3c8068bb')}</Tag>,
          },
          { title: translate('auto.a38a81c9d5'), dataIndex: 'message' },
          { title: translate('workflow.col_time'), dataIndex: 'created_at', width: 200, render: (v?: string) => (v ? formatDateTime(v) : '-') },
        ]}
      />
    </Card>
  )
}
