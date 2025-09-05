// features/tasks/components/TasksTable.tsx
import { EyeOutlined, PauseOutlined, SendOutlined } from '@ant-design/icons'
import { Button, Space, Table, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useMemo } from 'react'
import { AssignedUsersCell } from './AssignedUsersCell'
import { StatusTag } from './StatusTag'
import type { Task } from '../types'

const { Paragraph } = Typography

export const TasksTable: React.FC<{
  data: Task[]
  loading: boolean
  onView: (id: string) => void
  onPublish: (id: string) => void
  onUnpublish: (id: string) => void
}> = ({ data, loading, onView, onPublish, onUnpublish }) => {
  const columns: ColumnsType<Task> = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        render: (text, record) => (
          <Space direction="vertical" size={2} style={{ maxWidth: 480 }}>
            <Paragraph style={{ margin: 0, fontWeight: 600 }} ellipsis={{ rows: 1, tooltip: text }}>
              {text}
            </Paragraph>
            <Paragraph type="secondary" style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: record.description }}>
              {record.description}
            </Paragraph>
          </Space>
        ),
      },
      { title: '分配用户', dataIndex: 'assigned_users', width: 240, render: u => <AssignedUsersCell users={u} /> },
      { title: '状态', dataIndex: 'status', width: 120, render: s => <StatusTag status={s} /> },
      {
        title: '开始时间',
        dataIndex: 'start_time',
        width: 180,
        render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '结束时间',
        dataIndex: 'end_time',
        width: 180,
        render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 200,
        render: (_, r) => (
          <Space>
            <Tooltip title="查看详情">
              <Button type="link" icon={<EyeOutlined />} onClick={() => onView(r.id)}>
                详情
              </Button>
            </Tooltip>
            {r.status !== 'published' ? (
              <Tooltip title="发布任务">
                <Button type="link" icon={<SendOutlined />} onClick={() => onPublish(r.id)}>
                  发布
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="取消发布">
                <Button type="link" danger icon={<PauseOutlined />} onClick={() => onUnpublish(r.id)}>
                  下线
                </Button>
              </Tooltip>
            )}
          </Space>
        ),
      },
    ],
    [onView, onPublish, onUnpublish]
  )

  return (
    <Table<Task>
      rowKey="id"
      loading={loading}
      dataSource={data}
      columns={columns}
      scroll={{ x: 1000 }}
      pagination={false}
    />
  )
}
