import { Button, Space, Table, Tag, Typography, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Edit, Trash2 } from 'lucide-react'
import { createPaginationConfig } from '@shared/constants/pagination'
import type { NotificationDTO } from '../api/notifications'
const { Text } = Typography

export default function NotificationTable({
  data,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
  typeColor,
}: {
  data: NotificationDTO[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number, s: number) => void
  onEdit: (row: NotificationDTO) => void
  onDelete: (id: number) => void
  typeColor: Record<string, string>
}) {
  const columns: ColumnsType<NotificationDTO> = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 200, ellipsis: true },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ maxWidth: 300 }} ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: string) => (
        <Tag color={typeColor[t] || 'blue'}>
          {({ info: '信息', success: '成功', warning: '警告', error: '错误' } as any)[t] || '信息'}
        </Tag>
      ),
    },
    {
      title: '接收用户',
      dataIndex: 'user',
      key: 'user',
      width: 140,
      render: (u: any) => <Text>{u?.real_name || u?.username || '未知用户'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 80,
      render: (b: boolean) => <Tag color={b ? 'green' : 'orange'}>{b ? '已读' : '未读'}</Tag>,
    },
    {
      title: '发送时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, row) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<Edit style={{ width: 16, height: 16 }} />}
            onClick={() => onEdit(row)}
          >
            编辑
          </Button>
          <Popconfirm title="确定要删除这条通知吗？" onConfirm={() => onDelete(row.id)}>
            <Button type="text" size="small" danger icon={<Trash2 style={{ width: 16, height: 16 }} />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: onPageChange,
        ...createPaginationConfig(),
      }}
    />
  )
}
