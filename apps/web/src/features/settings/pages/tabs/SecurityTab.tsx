// src/features/settings/pages/tabs/SecurityTab.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { App, Table } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import { useAuth } from '@/shared/contexts/AuthContext'
import { logsApi, type LogEntry } from '@/shared/api/endpoints/logs'
import './security-tab.css'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type Row = LogEntry & {
  // 兼容后端可能在 details 里放地理和客户端信息
  details?: any
}

function brief(r: Row) {
  const base =
    (r as any).message ?? (typeof r.details === 'string' ? r.details : r.details ? JSON.stringify(r.details) : '')
  return base || r.action || '-'
}

function pickLocation(r: Row) {
  const d = (r as any).details || {}
  const fromDetails =
    d.location ||
    [d.country, d.province || d.region, d.city].filter(Boolean).join(' ') ||
    [d.nation, d.province, d.city].filter(Boolean).join('')
  return fromDetails || (r as any).location || (r as any).geo || '-'
}

function parseOS(ua?: string) {
  if (!ua) return ''
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X|macOS/i.test(ua)) return 'macOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iOS/i.test(ua)) return 'iOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return ''
}
function parseBrowser(ua?: string) {
  if (!ua) return ''
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/Chrome\//i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari'
  if (/MSIE|Trident/i.test(ua)) return 'IE'
  return ''
}

export default function SecurityTab() {
  const { message } = App.useApp()
  const { user } = useAuth()

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const columns = useMemo(
    () => [
      {
        title: translate('auto.4f55ee1e68'),
        dataIndex: 'message',
        ellipsis: true,
        render: (_: any, r: Row) => brief(r),
      },
      {
        title: translate('auto.010efa2cbc'),
        dataIndex: 'ip_address',
        width: 160,
        ellipsis: true,
      },
      {
        title: translate('auto.e9e0a3f4e5'),
        width: 200,
        ellipsis: true,
        render: (_: any, r: Row) => pickLocation(r),
      },
      {
        title: translate('auto.7c30099b89'),
        width: 140,
        ellipsis: true,
        render: (_: any, r: Row) => r.client?.os || parseOS(r.user_agent) || '-',
      },
      {
        title: translate('auto.d9dcf7d362'),
        width: 160,
        ellipsis: true,
        render: (_: any, r: Row) => r.client?.browser || parseBrowser(r.user_agent) || '-',
      },
      {
        title: translate('workflow.col_time'),
        dataIndex: 'created_at',
        width: 200,
        ellipsis: true,
        align: 'right' as const,
        render: (t: string) => (t ? formatDateTime(t) : '-'),
      },
    ],
    []
  )

  const load = async () => {
    try {
      setLoading(true)
      // 只取“当前用户”的安全/操作类日志：用用户名过滤
      const ret = await logsApi.listAudit(
        { level: 'all', username: user?.email || '' },
        page,
        pageSize
      )
      setRows(ret.items as Row[])
      setTotal(ret.total)
    } catch (e) {
      console.error(e)
      message.error(translate('auto.d4c704810c'))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, user?.email])

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{translate('auto.eb7770fabe')}</h2>

      <Table<Row>
        className="security-log-table"
        columns={columns as any}
        dataSource={rows}
        rowKey={r => String(r.id)}
        loading={loading}
        pagination={false}
        size="middle"
        tableLayout="fixed"
        scroll={{ x: 900 }}
        rowClassName={(_, idx) => (idx % 2 ? 'ant-table-row-striped' : '')}
      />

      {!loading && (
        <GlobalPagination total={total} current={page} pageSize={pageSize} onChange={p => setPage(p)} showSizeChanger={false} />
      )}
    </div>
  )
}
