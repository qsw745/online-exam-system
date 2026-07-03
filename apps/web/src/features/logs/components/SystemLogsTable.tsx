// apps/web/src/features/logs/components/SystemLogsTable.tsx
import React from 'react'
import { Descriptions, Modal, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from '@/shared/utils/dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

// ✅ 允许出现各式各样的后端别名字段
type Row = LogEntry & {
  module?: string
  module_name?: string
  endpoint?: string
  geo?: string
  [k: string]: any
}

const getDetails = (row: Row): Record<string, any> => {
  const raw = (row as any).details
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>
  return {}
}

const pickModule = (r: Row) => {
  const a = r as any
  const d = getDetails(r)
  return normalizeText(a.module || a.module_name || a.log_type || d.module || a.resource)
}

const pickPath = (r: Row) => {
  const a = r as any
  const d = getDetails(r)
  return normalizeText(a.path || a.url || a.endpoint || a.resource || d.path || d.url)
}

const pickMethod = (r: Row) => {
  const a = r as any
  const d = getDetails(r)
  const m = (a.method || d.method || d.http_method || a.action || '')?.toString()?.toUpperCase()
  return m || '-'
}

const pickIP = (r: Row) => {
  const a = r as any
  const d = getDetails(r)
  return normalizeText(a.ip_address || a.ip || d.ip || d.remote_addr)
}

const pickLocation = (r: Row) => {
  const a = r as any
  const d = getDetails(r)
  const str = a.geo || d.location || [d.country, d.province ?? d.region, d.city].filter(Boolean).join('')
  return normalizeText(str)
}

const pickOS = (r: Row) => normalizeText((r as any).client?.os || (r as any).os)
const pickBrowser = (r: Row) => normalizeText((r as any).client?.browser || (r as any).browser)

const pickDuration = (r: Row) => {
  const a = r as any
  const d = getDetails(r)
  const ms =
    a.duration_ms ??
    d.duration_ms ??
    d.time_ms ??
    d.cost_ms ??
    d.latency_ms ??
    d.duration ??
    d.performance?.duration_ms ??
    d.metrics?.duration ??
    null
  const num = Number(ms)
  return Number.isFinite(num) && num >= 0 ? num : undefined
}

function normalizeText(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
const durTag = (ms?: number) => {
  if (ms == null) return <Tag>-</Tag>
  const color = ms <= 100 ? 'green' : ms <= 1000 ? 'orange' : 'red'
  return <Tag color={color}>{`${ms} ms`}</Tag>
}

export default function SystemLogsTable({ data, loading }: { data: Row[]; loading: boolean }) {
  const [detail, setDetail] = React.useState<Row | null>(null)

  const columns: ColumnsType<Row> = [
    { title: 'ID', dataIndex: 'id', width: 80, fixed: 'left' },
    { title: translate('auto.27713f242f'), width: 160, ellipsis: true, render: (_: any, r) => pickModule(r) },
    { title: translate('auto.4a30b04730'), width: 260, ellipsis: true, render: (_: any, r) => pickPath(r) },
    { title: translate('auto.4d150364fe'), width: 110, ellipsis: true, render: (_: any, r) => pickMethod(r) },
    { title: translate('auto.010efa2cbc'), width: 150, ellipsis: true, render: (_: any, r) => pickIP(r) },
    { title: translate('auto.e9e0a3f4e5'), width: 220, ellipsis: true, render: (_: any, r) => pickLocation(r) },
    { title: translate('auto.7c30099b89'), width: 140, ellipsis: true, render: (_: any, r) => pickOS(r) },
    { title: translate('auto.d9dcf7d362'), width: 140, ellipsis: true, render: (_: any, r) => pickBrowser(r) },
    { title: translate('auto.94b035f8ef'), width: 120, align: 'center', render: (_: any, r) => durTag(pickDuration(r)) },
    {
      title: translate('auto.e8b5eda03a'),
      dataIndex: 'created_at',
      width: 180,
      render: (t?: string) => (t ? formatDateTime(t) : '-'),
    },
    {
      title: translate('users.columns.actions'),
      width: 100,
      fixed: 'right',
      onCell: () => ({ style: { background: '#fff' } }),
      render: (_: any, r) => (
        <div style={{ textAlign: 'center' }}>
          <a onClick={() => setDetail(r)}>{translate('auto.4f55ee1e68')}</a>
        </div>
      ),
    },
  ]

  return (
    <>
      <Table<Row>
        columns={columns}
        dataSource={data}
        rowKey={r => String((r as any).id)}
        loading={loading}
        pagination={false}
        size="small"
        tableLayout="fixed"
        scroll={{ x: 1600 }}
      />
      <Modal
        title={translate('auto.88b864bdf6')}
        open={!!detail}
        width={760}
        onCancel={() => setDetail(null)}
        onOk={() => setDetail(null)}
        destroyOnHidden
      >
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label={translate('workflowTemplates.columns.module')}>{pickModule(detail)}</Descriptions.Item>
              <Descriptions.Item label={translate('auto.4a30b04730')}>{pickPath(detail)}</Descriptions.Item>
              <Descriptions.Item label={translate('auto.b77e2ac8f4')}>{pickMethod(detail)}</Descriptions.Item>
              <Descriptions.Item label={translate('auto.010efa2cbc')}>{pickIP(detail)}</Descriptions.Item>
              <Descriptions.Item label={translate('auto.e9e0a3f4e5')}>{pickLocation(detail)}</Descriptions.Item>
              <Descriptions.Item label={translate('auto.a9704e1997')}>{`${pickDuration(detail)} ms`}</Descriptions.Item>
              <Descriptions.Item label={translate('workflow.col_time')}>
                {detail.created_at ? formatDateTime(detail.created_at) : '-'}
              </Descriptions.Item>
            </Descriptions>
            <div
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 6,
                padding: 12,
                background: '#fafafa',
                maxHeight: 320,
                overflow: 'auto',
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(detail, null, 2)}
              </pre>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
