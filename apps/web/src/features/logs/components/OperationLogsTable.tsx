import React from 'react'
import { Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from '@/shared/utils/dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'

const { Paragraph } = Typography

type Row = LogEntry & {
  module?: string
  module_name?: string
  category?: string
  location?: string
  geo?: string
  user_agent?: string
  client?: { os?: string; browser?: string; type?: string }
  details?: any
}

function pickModule(r: Row) {
  const d = r.details || {}
  return (
    r.module || r.module_name || d.module || r.category || d.category || r.resource || d.resource || r.log_type || '-'
  )
}

function pickSummary(r: Row) {
  const d = r.details || {}
  return (
    r.message ||
    d.summary ||
    d.remark ||
    d.description ||
    (r.action ? `${r.action}${r.resource ? ` - ${r.resource}` : ''}` : '') ||
    '-'
  )
}

function pickLocation(r: Row) {
  const d = r.details || {}
  const fromDetails =
    d.location ||
    [d.country, d.province || d.region, d.city].filter(Boolean).join('') ||
    [d.nation, d.province, d.city].filter(Boolean).join('')
  return fromDetails || r.location || (r as any).login_location || r.geo || '-'
}

function pickOS(r: Row) {
  return r.client?.os || (r as any).os || parseOS(r.user_agent) || '-'
}
function pickBrowser(r: Row) {
  return r.client?.browser || (r as any).browser || parseBrowser(r.user_agent) || '-'
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

function statusInfo(r: Row) {
  const s = String(r.status || '').toLowerCase()
  if (['success', 'ok', 'passed', 'true', '有效', '成功'].includes(s)) return { text: '成功', color: 'green' as const }
  if (['fail', 'failed', 'error', 'false', '无效', '失败', 'unauthorized'].includes(s))
    return { text: '失败', color: 'red' as const }
  if (String(r.level).toLowerCase() === 'error') return { text: '失败', color: 'red' as const }
  return { text: '成功', color: 'green' as const }
}

export default function OperationLogsTable({
  data,
  loading,
  page,
  pageSize,
}: {
  data: Row[]
  loading: boolean
  page: number
  pageSize: number
}) {
  const columns: ColumnsType<Row> = [
    {
      title: '序号',
      width: 72,
      align: 'center',
      fixed: 'left',
      render: (_: any, __, idx) => (page - 1) * pageSize + idx + 1,
    },
    {
      title: '操作人员',
      dataIndex: 'username',
      width: 140,
      fixed: 'left',
      ellipsis: true,
      render: (v?: string) => v || '系统',
    },
    {
      title: '所属模块',
      width: 160,
      ellipsis: true,
      render: (_: any, r) => pickModule(r),
    },
    {
      title: '操作概要',
      width: 300,
      render: (_: any, r) => {
        const text = pickSummary(r)
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
      title: '操作 IP',
      dataIndex: 'ip_address',
      width: 150,
      ellipsis: true,
    },
    {
      title: '操作地点',
      width: 220,
      ellipsis: true,
      render: (_: any, r) => pickLocation(r),
    },
    {
      title: '操作系统',
      width: 140,
      ellipsis: true,
      render: (_: any, r) => pickOS(r),
    },
    {
      title: '浏览器类型',
      width: 140,
      ellipsis: true,
      render: (_: any, r) => pickBrowser(r),
    },
    {
      title: '操作状态',
      width: 120,
      align: 'center',
      render: (_: any, r) => {
        const s = statusInfo(r)
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      width: 180,
      render: (t?: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
  ]

  return (
    <Table<Row>
      columns={columns}
      dataSource={data}
      rowKey={r => String(r.id)}
      loading={loading}
      pagination={false}
      size="small"
      tableLayout="fixed"
      scroll={{ x: 1500 }}
    />
  )
}
