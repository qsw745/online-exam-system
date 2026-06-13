import React from 'react'
import { Table, Tag, Space, Button, Popconfirm } from 'antd'

export type Task = {
  id: string
  title: string
  description?: string
  assigned_users?: Array<{ id: number; name?: string; username?: string }>
  status:
    | 'draft'
    | 'published'
    | 'unpublished'
    | 'not_started'
    | 'in_progress'
    | 'completed'
    | 'expired'
    | 'archived'
    | string
  type?: 'exam' | 'practice'
  exam_id?: number | null
  start_time?: string | null
  end_time?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Props = {
  data: Task[]
  loading?: boolean
  showPublishActions?: boolean
  showStartAction?: boolean
  /** ★ 用 onEdit 取代 onView */
  onEdit?: (id: string) => void | Promise<void>
  onPublish?: (id: string) => void | Promise<void>
  onUnpublish?: (id: string) => void | Promise<void>
  onStart?: (task: Task) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
}

const statusText = (s: Task['status']) =>
  s === 'draft'
    ? '草稿'
    : s === 'published'
    ? '已发布'
    : s === 'unpublished'
    ? '未发布'
    : s === 'not_started'
    ? '待开始'
    : s === 'in_progress'
    ? '进行中'
    : s === 'completed'
    ? '已完成'
    : s === 'expired'
    ? '已过期'
    : s === 'archived'
    ? '已归档'
    : String(s || '')

const statusColor = (s: Task['status']) =>
  s === 'published'
    ? 'blue'
    : s === 'in_progress'
    ? 'processing'
    : s === 'completed'
    ? 'green'
    : s === 'expired'
    ? 'orange'
    : s === 'draft'
    ? 'default'
    : s === 'archived'
    ? 'default'
    : 'default'

export const TasksTable: React.FC<Props> = ({
  data,
  loading,
  showPublishActions,
  showStartAction,
  onEdit,
  onPublish,
  onUnpublish,
  onStart,
  onDelete,
}) => {
  return (
    <Table<Task>
      rowKey="id"
      loading={loading}
      dataSource={data}
      pagination={false}
      scroll={{ x: 1200 }}
      columns={[
        { title: '任务标题', dataIndex: 'title', key: 'title', ellipsis: true },
        {
          title: '类型',
          dataIndex: 'type',
          key: 'type',
          width: 100,
          render: (t: Task['type']) => (t === 'exam' ? '考试' : t === 'practice' ? '练习' : '-'),
        },
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 120,
          render: (s: Task['status']) => <Tag color={statusColor(s)}>{statusText(s)}</Tag>,
        },
        { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 180 },
        { title: '截止时间', dataIndex: 'end_time', key: 'end_time', width: 180 },
        { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
        {
          title: '操作',
          key: 'actions',
          width: 280,
          fixed: 'right',
          onHeaderCell: () => ({
            style: {
              background: '#fff',
            },
          }),
          onCell: () => ({
            style: {
              background: '#fff',
            },
          }),
          render: (_: any, r: Task) => {
            const canStart =
              showStartAction && (r.status === 'not_started' || r.status === 'published' || r.status === 'in_progress')

            return (
              <Space
                wrap
                style={{
                  background: '#fff',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                {onEdit && <Button onClick={() => onEdit?.(r.id)}>编辑</Button>}

                {canStart && (
                  <Button type="primary" onClick={() => onStart?.(r)}>
                    开始
                  </Button>
                )}

                {showPublishActions && r.status !== 'published' && r.status !== 'archived' && (
                  <Button type="primary" onClick={() => onPublish?.(r.id)}>
                    发布
                  </Button>
                )}
                {showPublishActions && r.status === 'published' && (
                  <Button danger onClick={() => onUnpublish?.(r.id)}>
                    下线
                  </Button>
                )}

                {onDelete && (
                  <Popconfirm
                    title="确认删除该任务？"
                    description="删除后不可恢复，请谨慎操作。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => onDelete?.(r.id)}
                  >
                    <Button danger>删除</Button>
                  </Popconfirm>
                )}
              </Space>
            )
          },
        },
      ]}
    />
  )
}

export default TasksTable
