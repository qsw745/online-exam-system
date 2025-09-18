import { Button, Empty, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeOutlined, EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Paper } from '@/shared/api/endpoints/papers'

const { Text } = Typography

const diffText: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
const diffColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
  default: 'default',
}

function formatDate(input?: string | number | Date): string {
  if (!input) return '-'
  try {
    const d = new Date(input)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('zh-CN')
  } catch {
    return '-'
  }
}

export default function PapersTable({
  items,
  loading,
  onView,
  onEdit,
  onDelete,
}: {
  items: Paper[]
  loading?: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const columns: ColumnsType<Paper> = [
    {
      title: '试卷',
      dataIndex: 'title',
      key: 'title',
      render: (_: any, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.title}</Text>
          {r.description ? (
            <Text type="secondary" ellipsis style={{ maxWidth: 520 }}>
              {r.description}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 120,
      render: (d?: string) => <Tag color={diffColor[d || 'default']}>{diffText[d || ''] || d || '—'}</Tag>,
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      align: 'right',
      render: (v?: number) => (typeof v === 'number' ? `${v} 分` : '—'),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      align: 'right',
      render: (v?: number) => (typeof v === 'number' ? `${v} 分钟` : '—'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at' as any, // 后端可能返回 createdAt/created_at
      key: 'created_at',
      width: 200,
      render: (_: any, r) => formatDate((r as any).created_at ?? (r as any).createdAt),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_: any, r) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => onView(r.id)}>
            查看
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(r.id)}>
            编辑
          </Button>
          <Tooltip title="删除后不可恢复">
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => onDelete(r.id)}>
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Table<Paper>
      rowKey="id"
      size="middle"
      bordered
      sticky
      columns={columns}
      dataSource={items}
      loading={loading}
      pagination={false}
      locale={{
        emptyText: (
          <Empty image={<FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />} description="暂无试卷" />
        ),
      }}
    />
  )
}
