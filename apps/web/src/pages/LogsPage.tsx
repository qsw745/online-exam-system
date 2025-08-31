// src/pages/LogsPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { FileText, Search, Download, Filter } from 'lucide-react'
import { api } from '../lib/api'
import { createPaginationConfig } from '../constants/pagination'

const { RangePicker } = DatePicker
const { Option } = Select
const { Title, Text, Paragraph } = Typography

interface LogEntry {
  id: number
  log_type: string
  user_id?: number
  username?: string
  action: string
  resource: string
  message?: string
  details?: unknown
  ip_address: string
  user_agent: string
  level: 'info' | 'warning' | 'error'
  status?: string
  created_at: string
}

type LogsResponse =
  | LogEntry[]
  | { items: LogEntry[]; total?: number }
  | { data: LogEntry[]; total?: number }
  | { logs: LogEntry[]; total?: number }
  | { success: boolean; data: LogEntry[] | { items: LogEntry[]; total?: number } }

export default function LogsPage() {
  const { message } = App.useApp()

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<{
    level: 'all' | 'info' | 'warning' | 'error'
    action: string
    username: string
    dateRange: [Dayjs, Dayjs] | null
  }>({ level: 'all', action: '', username: '', dateRange: null })

  // 详情弹窗
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentLog, setCurrentLog] = useState<LogEntry | null>(null)

  const openDetail = (log: LogEntry) => {
    setCurrentLog(log)
    setDetailOpen(true)
  }
  const closeDetail = () => {
    setDetailOpen(false)
    setCurrentLog(null)
  }

  const parseLogsPayload = (payload: any): { items: LogEntry[]; total: number } => {
    let data: any = payload
    if (data && typeof data === 'object' && 'success' in data) data = data.data
    if (data && typeof data === 'object' && 'data' in data && !Array.isArray(data)) data = data.data

    if (Array.isArray(data)) return { items: data as LogEntry[], total: Number(payload?.total ?? data.length) }
    if (data && Array.isArray(data.items))
      return { items: data.items as LogEntry[], total: Number(data.total ?? data.items.length) }
    if (data && Array.isArray(data.logs))
      return { items: data.logs as LogEntry[], total: Number(data.total ?? data.logs.length) }

    return { items: [], total: 0 }
  }

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: pageSize,
        level: filters.level !== 'all' ? filters.level : undefined,
        action: filters.action || undefined,
        username: filters.username || undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      }
      const res = await api.get<LogsResponse>('/logs', { params })
      const parsed = parseLogsPayload(res as any)
      setLogs(Array.isArray(parsed.items) ? parsed.items : [])
      setTotal(Number.isFinite(parsed.total) ? parsed.total : 0)
    } catch (err) {
      console.error('获取日志失败:', err)
      message.error('获取日志失败')
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // 兼容封装的 blob 响应
  const pickBlobPart = (resp: unknown): BlobPart => {
    const anyResp = resp as any
    return anyResp?.data ?? anyResp
  }

  const exportLogs = async () => {
    try {
      const params = {
        level: filters.level !== 'all' ? filters.level : undefined,
        action: filters.action || undefined,
        username: filters.username || undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        format: 'csv',
      }
      const resp = await api.get('/logs/export', { params, responseType: 'blob' as any })
      const blob = new Blob([pickBlobPart(resp)], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${dayjs().format('YYYY-MM-DD')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success('日志导出成功')
    } catch (err) {
      console.error('导出日志失败:', err)
      message.error('导出日志失败')
    }
  }

  const getLevelColor = (level: string) =>
    level === 'info' ? 'blue' : level === 'warning' ? 'orange' : level === 'error' ? 'red' : undefined
  const getLevelText = (level: string) =>
    level === 'info' ? '信息' : level === 'warning' ? '警告' : level === 'error' ? '错误' : level

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, JSON.stringify(filters)])

  // 生成简要信息
  const buildBrief = (record: LogEntry) => {
    const base =
      record.message ??
      (typeof record.details === 'string' ? record.details : record.details ? JSON.stringify(record.details) : '')
    const text = base || `${record.action} @ ${record.resource}`
    return text
  }

  const columns: ColumnsType<LogEntry> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '级别',
        dataIndex: 'level',
        key: 'level',
        width: 90,
        render: (level: LogEntry['level']) => <Tag color={getLevelColor(level)}>{getLevelText(level)}</Tag>,
      },
      {
        title: '用户',
        dataIndex: 'username',
        key: 'username',
        width: 160,
        render: (username: string, record) =>
          username ? (
            <div>
              <Text strong>{username}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {record.user_id}
              </Text>
            </div>
          ) : (
            <Text type="secondary">系统</Text>
          ),
      },
      {
        title: '操作',
        dataIndex: 'action',
        key: 'action',
        width: 150,
        render: (a: string) => <Tag color="purple">{a}</Tag>,
      },
      { title: '资源', dataIndex: 'resource', key: 'resource', width: 160 },
      {
        title: '详情',
        key: 'details',
        // ⚠️ 不用 antd 的 ellipsis，自己做省略，保证按钮可点击
        render: (_: unknown, record) => {
          const full = buildBrief(record)
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                title={full}
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: 'rgba(0,0,0,0.65)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {full}
              </span>
              {/* <Button type="link" size="small" onClick={() => openDetail(record)}>
                查看详情
              </Button> */}
            </div>
          )
        },
      },
      { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address', width: 140 },
      {
        title: '用户代理',
        dataIndex: 'user_agent',
        key: 'user_agent',
        width: 240,
        render: (ua: string) => (
          <Text type="secondary" style={{ fontSize: 12 }} title={ua}>
            {ua}
          </Text>
        ),
      },
    ],
    [] // openDetail 是稳定引用，这里保持空依赖即可
  )

  // 详情 JSON 文本
  const detailsText = useMemo(() => {
    if (!currentLog) return ''
    const obj = {
      id: currentLog.id,
      time: dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss'),
      level: currentLog.level,
      user: currentLog.username ?? '系统',
      user_id: currentLog.user_id ?? null,
      action: currentLog.action,
      resource: currentLog.resource,
      message: currentLog.message ?? null,
      details: currentLog.details ?? null,
      ip_address: currentLog.ip_address,
      user_agent: currentLog.user_agent,
      status: currentLog.status ?? null,
      log_type: currentLog.log_type,
    }
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(currentLog.details ?? '')
    }
  }, [currentLog])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <FileText style={{ width: 24, height: 24, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            日志管理
          </Title>
        </Space>
        <Button type="primary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={exportLogs}>
          导出日志
        </Button>
      </div>

      {/* 筛选器 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              日志级别
            </Text>
            <Select
              value={filters.level}
              onChange={v => setFilters(p => ({ ...p, level: v }))}
              style={{ width: '100%' }}
            >
              <Option value="all">全部级别</Option>
              <Option value="info">信息</Option>
              <Option value="warning">警告</Option>
              <Option value="error">错误</Option>
            </Select>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              操作类型
            </Text>
            <Input
              placeholder="搜索操作类型"
              value={filters.action}
              onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
              prefix={<Search style={{ width: 16, height: 16, color: '#bfbfbf' }} />}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              用户名
            </Text>
            <Input
              placeholder="搜索用户名"
              value={filters.username}
              onChange={e => setFilters(p => ({ ...p, username: e.target.value }))}
              prefix={<Search style={{ width: 16, height: 16, color: '#bfbfbf' }} />}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              时间范围
            </Text>
            <RangePicker
              value={filters.dateRange as any}
              onChange={dates => setFilters(p => ({ ...p, dateRange: (dates as any) ?? null }))}
              format="YYYY-MM-DD"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button
            icon={<Filter style={{ width: 16, height: 16 }} />}
            onClick={() => {
              setCurrentPage(1)
              fetchLogs()
            }}
          >
            应用筛选
          </Button>
        </div>
      </Card>

      {/* 列表 */}
      <Card>
        <Table<LogEntry>
          columns={columns}
          dataSource={Array.isArray(logs) ? logs : []}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
          size="small"
          // 支持双击整行打开详情
          onRow={record => ({
            onDoubleClick: () => openDetail(record),
          })}
          rowClassName={record =>
            record.level === 'error' ? 'bg-red-50' : record.level === 'warning' ? 'bg-orange-50' : ''
          }
        />

        {!loading && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              {...createPaginationConfig()}
              current={currentPage}
              total={total}
              pageSize={pageSize}
              onChange={(page, size) => {
                setCurrentPage(page)
                if (size && size !== pageSize) {
                  setPageSize(size)
                  setCurrentPage(1)
                }
              }}
              onShowSizeChange={(_, size) => {
                setPageSize(size)
                setCurrentPage(1)
              }}
            />
          </div>
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="日志详情"
        open={detailOpen}
        onOk={closeDetail}
        onCancel={closeDetail}
        width={800}
        okText="关闭"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        {currentLog ? (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="时间" span={2}>
                {dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="级别">
                <Tag color={getLevelColor(currentLog.level)}>{getLevelText(currentLog.level)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="用户">
                {currentLog.username ? (
                  <>
                    {currentLog.username} <Text type="secondary">（ID: {currentLog.user_id}）</Text>
                  </>
                ) : (
                  '系统'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="操作">{currentLog.action}</Descriptions.Item>
              <Descriptions.Item label="资源">{currentLog.resource}</Descriptions.Item>
              <Descriptions.Item label="IP">{currentLog.ip_address}</Descriptions.Item>
              <Descriptions.Item label="类型">{currentLog.log_type}</Descriptions.Item>
              <Descriptions.Item label="状态">{currentLog.status ?? '-'}</Descriptions.Item>
            </Descriptions>

            <Text strong>原始数据</Text>
            <Paragraph copyable style={{ marginTop: 8 }}>
              <pre
                style={{
                  background: '#f6f6f6',
                  borderRadius: 8,
                  padding: 12,
                  maxHeight: 360,
                  overflow: 'auto',
                }}
              >
                {(() => {
                  try {
                    return JSON.stringify(
                      {
                        ...currentLog,
                        created_at: dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss'),
                      },
                      null,
                      2
                    )
                  } catch {
                    return String(currentLog.details ?? '')
                  }
                })()}
              </pre>
            </Paragraph>
          </>
        ) : (
          <Text type="secondary">暂无数据</Text>
        )}
      </Modal>
    </div>
  )
}
