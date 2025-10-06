// apps/web/src/features/logs/components/SystemLogsTable.tsx
import React from 'react'
import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from '@/shared/utils/dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'

// ✅ 允许出现各式各样的后端别名字段
type Row = LogEntry & {
  module?: string
  module_name?: string
  endpoint?: string
  geo?: string
  [k: string]: any
}

const pickModule = (r: Row) => {
  const a = r as any
  const d = (a.details || {}) as any
  return a.module || a.module_name || a.log_type || d.module || a.resource || '-'
}

const pickPath = (r: Row) => {
  const a = r as any
  const d = (a.details || {}) as any
  return a.path || a.url || a.endpoint || a.resource || d.path || d.url || '-'
}

const pickMethod = (r: Row) => {
  const a = r as any
  const d = (a.details || {}) as any
  return (a.method || d.method || d.http_method || a.action || '')?.toString()?.toUpperCase() || '-'
}

const pickIP = (r: Row) => {
  const a = r as any
  const d = (a.details || {}) as any
  return a.ip_address || a.ip || d.ip || d.remote_addr || '-'
}

const pickLocation = (r: Row) => {
  const a = r as any
  const d = (a.details || {}) as any
  return a.geo || d.location || [d.country, d.province ?? d.region, d.city].filter(Boolean).join('') || '-'
}

const pickOS = (r: Row) => (r as any).client?.os || (r as any).os || '-'
const pickBrowser = (r: Row) => (r as any).client?.browser || (r as any).browser || '-'

const pickDuration = (r: Row) => {
  const a = r as any
  const d = (a.details || {}) as any
  const ms = a.duration_ms ?? d.duration_ms ?? d.time_ms ?? d.cost_ms ?? d.latency_ms ?? d.duration ?? 0
  return Number(ms) || 0
}
const durTag = (ms: number) => {
  const color = ms <= 100 ? 'green' : ms <= 1000 ? 'orange' : 'red'
  return <Tag color={color}>{`${ms} ms`}</Tag>
}

export default function SystemLogsTable({ data, loading }: { data: Row[]; loading: boolean }) {
  const columns: ColumnsType<Row> = [
    { title: 'ID', dataIndex: 'id', width: 80, fixed: 'left' },
    { title: '所属模块', width: 160, ellipsis: true, render: (_: any, r) => pickModule(r) },
    { title: '请求接口', width: 260, ellipsis: true, render: (_: any, r) => pickPath(r) },
    { title: '请求方法', width: 110, ellipsis: true, render: (_: any, r) => pickMethod(r) },
    { title: 'IP 地址', width: 150, ellipsis: true, render: (_: any, r) => pickIP(r) },
    { title: '地点', width: 220, ellipsis: true, render: (_: any, r) => pickLocation(r) },
    { title: '操作系统', width: 140, ellipsis: true, render: (_: any, r) => pickOS(r) },
    { title: '浏览器类型', width: 140, ellipsis: true, render: (_: any, r) => pickBrowser(r) },
    { title: '请求耗时', width: 120, align: 'center', render: (_: any, r) => durTag(pickDuration(r)) },
    {
      title: '请求时间',
      dataIndex: 'created_at',
      width: 180,
      render: (t?: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_: any, r) => <a onClick={() => window?.alert?.(JSON.stringify(r, null, 2))}>详情</a>,
    },
  ]

  return (
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
  )
}
