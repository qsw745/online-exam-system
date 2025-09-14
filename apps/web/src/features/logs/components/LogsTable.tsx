import { Table, Tag, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'

const { Text, Paragraph } = Typography

const levelColor = (lv: string) =>
  lv === 'info' ? 'blue' : lv === 'warning' ? 'orange' : lv === 'error' ? 'red' : undefined
const levelText = (lv: string) => (lv === 'info' ? '信息' : lv === 'warning' ? '警告' : lv === 'error' ? '错误' : lv)

function brief(record: LogEntry) {
  const base =
    record.message ??
    (typeof record.details === 'string' ? record.details : record.details ? JSON.stringify(record.details) : '')
  return base || `${record.action} @ ${record.resource}`
}

const typeTagColor = (t?: string) =>
  t === 'mobile' ? 'green' : t === 'tablet' ? 'gold' : t === 'desktop' ? 'blue' : t === 'bot' ? 'purple' : 'default'

type Props = {
  data: LogEntry[]
  loading: boolean
  onRowDblClick: (record: LogEntry) => void
}

/**
 * 统一的单行省略文本（带 Tooltip）
 */
function OneLine({ text, title, className }: { text?: React.ReactNode; title?: React.ReactNode; className?: string }) {
  const content = <span className={`cell-clip ${className || ''}`}>{text ?? '-'}</span>
  return title ? <Tooltip title={title}>{content}</Tooltip> : content
}

export default function LogsTable({ data, loading, onRowDblClick }: Props) {
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      ellipsis: true,
      render: (t: string) => <OneLine text={dayjs(t).format('YYYY-MM-DD HH:mm:ss')} />,
      fixed: 'left',
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 92,
      ellipsis: true,
      render: l => (
        <span className="nowrap">
          <Tag color={levelColor(String(l))} style={{ marginRight: 0 }}>
            {levelText(String(l))}
          </Tag>
        </span>
      ),
      fixed: 'left',
    },
    {
      title: '用户',
      dataIndex: 'username',
      width: 180,
      render: (username: string, r) =>
        username ? (
          <div className="cell-user">
            <OneLine text={<Text strong>{username}</Text>} title={`ID: ${r.user_id} · ${username}`} />
            <Text type="secondary" className="cell-sub">
              ID: {r.user_id}
            </Text>
          </div>
        ) : (
          <Text type="secondary">系统</Text>
        ),
      ellipsis: true,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 140,
      ellipsis: true,
      render: (a: string) => (
        <OneLine
          text={
            <Tag color="purple" className="tag-tight">
              {a}
            </Tag>
          }
          title={a}
        />
      ),
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 180,
      ellipsis: true,
      render: (v?: string) => <OneLine text={v} title={v} />,
      responsive: ['md'],
    },
    {
      title: '详情',
      key: 'details',
      // 给详情更多空间，并做**两行**省略，防止拉高
      width: 360,
      render: (_: unknown, r) => {
        const text = brief(r)
        return (
          <Tooltip title={<pre className="pre-wrap">{text}</pre>}>
            <Paragraph className="cell-clip-2" ellipsis={{ rows: 2 }}>
              {text}
            </Paragraph>
          </Tooltip>
        )
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      width: 140,
      ellipsis: true,
      render: (v?: string) => <OneLine text={v} title={v} />,
      responsive: ['lg'],
    },
    {
      title: '客户端',
      dataIndex: 'client',
      width: 280,
      ellipsis: true,
      render: (_: any, r) => {
        const label =
          r.client?.label || [r.client?.device, r.client?.os, r.client?.browser].filter(Boolean).join(' · ') || '-'
        return (
          <Tooltip title={r.user_agent}>
            <div className="cell-client">
              <OneLine text={<Text className="client-label">{label}</Text>} title={r.user_agent} />
              <span className="nowrap">
                <Tag className="tag-tight" color={typeTagColor(r.client?.type)}>
                  {r.client?.type ?? 'unknown'}
                </Tag>
              </span>
            </div>
          </Tooltip>
        )
      },
      responsive: ['lg'],
    },
  ]

  return (
    <Table<LogEntry>
      className="logs-table"
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={false}
      // 关键：固定表格布局，避免被长内容撑爆
      tableLayout="fixed"
      // 视口宽度不足时横向滚动
      scroll={{ x: 1320 }}
      size="small"
      sticky
      onRow={record => ({ onDoubleClick: () => onRowDblClick(record) })}
      rowClassName={r => (r.level === 'error' ? 'bg-red-50' : r.level === 'warning' ? 'bg-orange-50' : '')}
    />
  )
}
