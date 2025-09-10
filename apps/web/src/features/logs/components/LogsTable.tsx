import { Table, Tag, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'

const { Text } = Typography

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

export default function LogsTable({
  data,
  loading,
  onRowDblClick,
}: {
  data: LogEntry[]
  loading: boolean
  onRowDblClick: (record: LogEntry) => void
}) {
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 90,
      render: l => <Tag color={levelColor(String(l))}>{levelText(String(l))}</Tag>,
    },
    {
      title: '用户',
      dataIndex: 'username',
      width: 160,
      render: (username: string, r) =>
        username ? (
          <div>
            <Text strong>{username}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {r.user_id}
            </Text>
          </div>
        ) : (
          <Text type="secondary">系统</Text>
        ),
    },
    { title: '操作', dataIndex: 'action', width: 150, render: (a: string) => <Tag color="purple">{a}</Tag> },
    { title: '资源', dataIndex: 'resource', width: 160 },
    {
      title: '详情',
      key: 'details',
      render: (_: unknown, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            title={brief(r)}
            style={{
              flex: 1,
              minWidth: 0,
              color: 'rgba(0,0,0,0.65)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {brief(r)}
          </span>
        </div>
      ),
    },
    { title: 'IP地址', dataIndex: 'ip_address', width: 140 },
    {
      title: '客户端', // ⬅️ 重命名列
      dataIndex: 'client',
      width: 260,
      render: (_: any, r) => {
        const label =
          r.client?.label || [r.client?.device, r.client?.os, r.client?.browser].filter(Boolean).join(' · ') || '-'
        return (
          <Tooltip title={r.user_agent}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text style={{ fontSize: 12 }}>{label}</Text>
              <div>
                <Tag size="small" color={typeTagColor(r.client?.type)} style={{ marginTop: 4 }}>
                  {r.client?.type ?? 'unknown'}
                </Tag>
              </div>
            </div>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <Table<LogEntry>
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={false}
      scroll={{ x: 1280 }}
      size="small"
      onRow={record => ({ onDoubleClick: () => onRowDblClick(record) })}
      rowClassName={r => (r.level === 'error' ? 'bg-red-50' : r.level === 'warning' ? 'bg-orange-50' : '')}
    />
  )
}
