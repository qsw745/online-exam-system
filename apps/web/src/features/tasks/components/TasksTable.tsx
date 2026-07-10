import React from 'react'
import { Table, Tag, Space, Button, Popconfirm } from 'antd'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
  my_result_id?: number | string | null
  my_result_status?: string | null
  my_result_score?: number | null
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
  onViewResult?: (task: Task) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
}

const doneResultStatuses = new Set(['completed', 'submitted', 'graded'])
const inProgressResultStatuses = new Set(['in_progress'])

const hasDoneResult = (task: Task) => task.type === 'exam' && doneResultStatuses.has(String(task.my_result_status || '').toLowerCase())

const displayStatus = (task: Task): Task['status'] => {
  const resultStatus = String(task.my_result_status || '').toLowerCase()
  if (doneResultStatuses.has(resultStatus)) return 'completed'
  if (inProgressResultStatuses.has(resultStatus)) return 'in_progress'
  return task.status
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
  onViewResult,
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
        { title: translate('auto.6eae640bc4'), dataIndex: 'title', key: 'title', ellipsis: true },
        {
          title: translate('systemConfig.col_type'),
          dataIndex: 'type',
          key: 'type',
          width: 100,
          render: (t: Task['type']) => (t === 'exam' ? translate('nav.exams') : t === 'practice' ? translate('menus.exam-practice') : '-'),
        },
        {
          title: translate('users.columns.status'),
          dataIndex: 'status',
          key: 'status',
          width: 120,
          render: (_s: Task['status'], r: Task) => {
            const s = displayStatus(r)
            return <Tag color={statusColor(s)}>{statusText(s)}</Tag>
          },
        },
        { title: translate('dashboard.start_time'), dataIndex: 'start_time', key: 'start_time', width: 180, render: (t?: string | null) => (t ? formatDateTime(t) : '-') },
        { title: translate('auto.864048b32f'), dataIndex: 'end_time', key: 'end_time', width: 180, render: (t?: string | null) => (t ? formatDateTime(t) : '-') },
        { title: translate('users.columns.created_at'), dataIndex: 'created_at', key: 'created_at', width: 180, render: (t?: string | null) => (t ? formatDateTime(t) : '-') },
        {
          title: translate('users.columns.actions'),
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
            const done = hasDoneResult(r)
            const hasResult = done && r.my_result_id != null
            const canStart =
              showStartAction && !done && (r.status === 'not_started' || r.status === 'published' || r.status === 'in_progress')

            return (
              <Space
                wrap
                style={{
                  background: '#fff',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                {onEdit && <Button onClick={() => onEdit?.(r.id)}>{translate('app.edit')}</Button>}

                {hasResult && (
                  <Button onClick={() => onViewResult?.(r)}>
                    {translate('exam.view_result')}
                  </Button>
                )}

                {done && !hasResult && (
                  <Button disabled>
                    {translate('dashboard.status_completed')}
                  </Button>
                )}

                {canStart && (
                  <Button type="primary" onClick={() => onStart?.(r)}>
                    {translate('workflowTemplates.node.start')}</Button>
                )}

                {showPublishActions && r.status !== 'published' && r.status !== 'archived' && (
                  <Button type="primary" onClick={() => onPublish?.(r.id)}>
                    {translate('auto.94f172d02f')}</Button>
                )}
                {showPublishActions && r.status === 'published' && (
                  <Button danger onClick={() => onUnpublish?.(r.id)}>
                    {translate('auto.706875155b')}</Button>
                )}

                {onDelete && (
                  <Popconfirm
                    title={translate('auto.f0e5964284')}
                    description={translate('auto.7072411649')}
                    okText={translate('app.delete')}
                    cancelText={translate('app.cancel')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => onDelete?.(r.id)}
                  >
                    <Button danger>{translate('app.delete')}</Button>
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
