import React from 'react'
import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from '@/shared/utils/dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'

type Row = LogEntry & {
  // 兼容后端可能的字段命名
  location?: string
  geo?: string
  client?: { os?: string; browser?: string }
  status?: string
  action?: string
  user_agent?: string
}

function pickLocation(r: Row) {
  const d: any = (r as any).details
  const fromDetails =
    d?.location ||
    [d?.country, d?.province || d?.region, d?.city].filter(Boolean).join(' ') ||
    [d?.nation, d?.province, d?.city].filter(Boolean).join('')
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
  // 回退到 level 判断
  if (String(r.level).toLowerCase() === 'error') return { text: '失败', color: 'red' as const }
  return { text: '成功', color: 'green' as const }
}

export default function LoginLogsTable({
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
      render: (_: any, __: Row, idx: number) => (page - 1) * pageSize + idx + 1,
      fixed: 'left',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 140,
      render: (v?: string) => v || '系统',
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '登录 IP',
      dataIndex: 'ip_address',
      width: 160,
      ellipsis: true,
    },
    {
      title: '登录地点',
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
      title: '登录状态',
      width: 120,
      align: 'center',
      render: (_: any, r) => {
        const s = statusInfo(r)
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '登录行为',
      dataIndex: 'action',
      width: 160,
      ellipsis: true,
      render: (v?: string) => v || '-',
    },
    {
      title: '登录时间',
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
      tableLayout="fixed"
      size="small"
      scroll={{ x: 1200 }}
    />
  )
}
