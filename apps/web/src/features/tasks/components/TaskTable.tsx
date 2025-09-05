// features/tasks/components/TaskTable.tsx
import { Button, Popconfirm, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useMemo } from 'react'
import { STATUS_COLOR, STATUS_LABEL } from '../constants'

export const TaskTable: React.FC<{
  data: any[]
  loading: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onPublish: (id: string) => void
  onUnpublish: (id: string) => void
}> = ({ data, loading, onView, onEdit, onDelete, onPublish, onUnpublish }) => {
  const columns: ColumnsType<any> = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        render: (text: string, r) => (
          <Space direction="vertical" size={2}>
            <div style={{ fontWeight: 600 }}>{text}</div>
            <div style={{ color: '#999' }}>{r.description}</div>
          </Space>
        ),
      },
      {
        title: '用户',
        dataIndex: 'username',
        width: 200,
        render: (_: any, r) => (
          <>
            {r.username || '未知用户'}
            <div style={{ color: '#999' }}>{r.email}</div>
          </>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (s: any) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] || s}</Tag>,
      },
      {
        title: '开始时间',
        dataIndex: 'start_time',
        width: 180,
        render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '结束时间',
        dataIndex: 'end_time',
        width: 180,
        render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 240,
        render: (_, r) => (
          <Space>
            <Button type="link" onClick={() => onView(r.id)}>
              详情
            </Button>
            <Button type="link" onClick={() => onEdit(r.id)}>
              编辑
            </Button>
            {r.status !== 'published' ? (
              <Button type="link" onClick={() => onPublish(r.id)}>
                发布
              </Button>
            ) : (
              <Button type="link" danger onClick={() => onUnpublish(r.id)}>
                下线
              </Button>
            )}
            <Popconfirm title="确定删除该任务？" onConfirm={() => onDelete(r.id)}>
              <Button type="link" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onView, onEdit, onPublish, onUnpublish, onDelete]
  )

  return (
    <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={{ x: 1100 }} />
  )
}
