import { Button, Empty, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Paper } from '@/shared/api/endpoints/papers'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text } = Typography

const diffKey: Record<string, string> = { easy: 'papers.diff_easy', medium: 'papers.diff_medium', hard: 'papers.diff_hard' }
const diffColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
  default: 'default',
}

function formatDate(input?: string | number | Date): string {
  return formatDateTime(input) || '-'
}

export default function PapersTable({
  items,
  loading,
  selectedRowKeys,
  onSelectionChange,
  onEdit,
  onDelete,
  onReviewToggle,
}: {
  items: Paper[]
  loading?: boolean
  selectedRowKeys: React.Key[]
  onSelectionChange: (keys: React.Key[]) => void
  onEdit: (id: string | number) => void
  onDelete: (id: string | number) => void
  onReviewToggle: (paper: Paper, enabled: boolean) => void
}) {
  const { t } = useLanguage()
  const columns: ColumnsType<Paper> = [
    {
      title: t('papers.col_paper'),
      dataIndex: 'title',
      key: 'title',
      width: 420,
      render: (_: any, r) => (
        <Space direction="vertical" size={0} style={{ maxWidth: 420 }}>
          <Text strong ellipsis={{ tooltip: r.title }}>
            {r.title}
          </Text>
          {r.description ? (
            <Text type="secondary" ellipsis={{ tooltip: r.description }}>
              {r.description}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('papers.col_difficulty'),
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 110,
      render: (d?: string) => <Tag color={diffColor[d || 'default']}>{diffKey[d || ''] ? t(diffKey[d || '']) : d || '—'}</Tag>,
    },
    {
      title: t('papers.col_total_score'),
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      align: 'right',
      render: (v?: number) => (typeof v === 'number' ? t('papers.score_unit').replace('{v}', String(v)) : '—'),
    },
    {
      title: t('papers.col_duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      align: 'right',
      render: (v?: number) => (typeof v === 'number' ? t('papers.duration_unit').replace('{v}', String(v)) : '—'),
    },
    {
      title: t('papers.col_created_at'),
      dataIndex: 'created_at' as any,
      key: 'created_at',
      width: 200,
      render: (_: any, r) => formatDate((r as any).created_at ?? (r as any).createdAt),
    },
    {
      title: t('papers.col_approval'),
      key: 'workflow',
      width: 180,
      render: (_: any, r) => {
        const raw = (r as any).workflow_requires_review
        const enabled = raw === true || raw === 1 || raw === '1'
        return (
          <Space size={8}>
            <Tag color={enabled ? 'processing' : 'default'}>{enabled ? t('papers.need_approval') : t('papers.no_approval')}</Tag>
            <Switch
              size="small"
              checked={enabled}
              checkedChildren={t('common.yes')}
              unCheckedChildren={t('common.no')}
              onChange={checked => onReviewToggle(r, checked)}
            />
          </Space>
        )
      },
    },
    {
      title: t('papers.col_actions'),
      key: 'actions',
      width: 200,
      fixed: 'right',
      onCell: () => ({ style: { background: '#fff' } }),
      onHeaderCell: () => ({ style: { background: '#fff' } }),
      render: (_: any, r) => (
        <Space size={4} wrap>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => onEdit(r.id)}>
            {t('app.edit')}
          </Button>
          <Tooltip title={t('papers.delete_tooltip')}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => onDelete(r.id)}>
              {t('app.delete')}
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
      scroll={{ x: 1080 }}
      rowSelection={{
        selectedRowKeys,
        onChange: onSelectionChange,
      }}
      locale={{
        emptyText: (
          <Empty image={<FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />} description={t('papers.empty')} />
        ),
      }}
    />
  )
}
