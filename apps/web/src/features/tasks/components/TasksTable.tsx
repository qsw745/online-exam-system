import { EyeOutlined, PauseOutlined, SendOutlined } from '@ant-design/icons'
import { Button, Space, Table, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
// 使用项目封装的 dayjs（避免类型/时区分歧）
import dayjs from '@/shared/utils/dayjs'
import React, { useMemo } from 'react'
import { AssignedUsersCell } from './AssignedUsersCell'
import StatusTag from './StatusTag'

export interface Task {
  id: string
  title: string
  description?: string
  assigned_users: Array<{ id: string | number; name: string }>
  status: 'draft' | 'published' | 'closed' | string
  start_time?: string | number | Date | null
  end_time?: string | number | Date | null
  created_at?: string | number | Date | null
}

const { Paragraph } = Typography

// 统一列宽，保证表头/内容不再互相挤压
const COL_W = {
  title: 420,
  users: 260,
  status: 120,
  time: 180,
  action: 200,
}

export const TasksTable: React.FC<{
  data: Task[]
  loading: boolean
  onView: (id: string) => void
  onPublish: (id: string) => void
  onUnpublish: (id: string) => void
}> = ({ data, loading, onView, onPublish, onUnpublish }) => {
  const renderTime = (t?: string | number | Date | null) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-')

  const columns: ColumnsType<Task> = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        width: COL_W.title,
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (text, record) => (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Paragraph style={{ margin: 0, fontWeight: 600 }} ellipsis={{ rows: 1, tooltip: text }}>
              {text}
            </Paragraph>
            {record.description ? (
              <Paragraph type="secondary" style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: record.description }}>
                {record.description}
              </Paragraph>
            ) : null}
          </Space>
        ),
      },
      {
        title: '分配用户',
        dataIndex: 'assigned_users',
        width: COL_W.users,
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: u => (
          <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
            <AssignedUsersCell users={u} />
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: COL_W.status,
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: s => <StatusTag status={s} />,
      },

      // —— 大屏显示 3 列时间 ——
      {
        title: '开始时间',
        dataIndex: 'start_time',
        width: COL_W.time,
        responsive: ['lg'],
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: t => renderTime(t),
      },
      {
        title: '结束时间',
        dataIndex: 'end_time',
        width: COL_W.time,
        responsive: ['lg'],
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: t => renderTime(t),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: COL_W.time,
        responsive: ['lg'],
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: t => renderTime(t),
      },

      // —— 中小屏把时间折叠为一列，避免拥挤 ——
      {
        title: '时间',
        key: 'time_compact',
        width: COL_W.time + 40,
        responsive: ['xs', 'sm', 'md'],
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (_, r) => (
          <div style={{ lineHeight: 1.4 }}>
            <div>
              {renderTime(r.start_time)} ~ {renderTime(r.end_time)}
            </div>
            <div style={{ color: 'var(--ant-color-text-secondary)' }}>创建：{renderTime(r.created_at)}</div>
          </div>
        ),
      },

      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: COL_W.action,
        onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
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

  const totalX = COL_W.title + COL_W.users + COL_W.status + COL_W.action + COL_W.time * 3 + 80 // 额外留白

  return (
    <Table<Task>
      rowKey="id"
      size="middle"
      loading={loading}
      dataSource={data}
      columns={columns}
      tableLayout="fixed" // ✔ 固定表格布局，严格按 width 分配
      scroll={{ x: totalX }} // ✔ 横向滚动，防止列拥挤
      pagination={false}
      onRow={() => ({ style: { verticalAlign: 'top' } })} // ✔ 多行内容顶部对齐，视觉更整齐
    />
  )
}
