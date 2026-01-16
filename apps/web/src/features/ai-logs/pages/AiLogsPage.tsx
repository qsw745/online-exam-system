import React from 'react'
import { Button, Card, DatePicker, Drawer, Input, Space, Table, Tag, Typography, message } from 'antd'
import { Download, Search } from 'lucide-react'
import dayjs from 'dayjs'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { aiLogsApi, type AiLogFilters, type AiLogItem } from '@/shared/api/endpoints/ai-logs'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

const initialFilters: AiLogFilters = {
  keyword: '',
  model: '',
  sessionId: '',
  userId: undefined,
  dateRange: null,
}

export default function AiLogsPage() {
  const [draft, setDraft] = React.useState<AiLogFilters>(initialFilters)
  const [filters, setFilters] = React.useState<AiLogFilters>(initialFilters)
  const [items, setItems] = React.useState<AiLogItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [loading, setLoading] = React.useState(false)
  const [active, setActive] = React.useState<AiLogItem | null>(null)

  const fetchLogs = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiLogsApi.list(filters, page, pageSize)
      setItems(res.items)
      setTotal(res.total)
    } catch (e: any) {
      message.error(e?.message || '加载AI问答记录失败')
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize])

  React.useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const onSearch = () => {
    setPage(1)
    setFilters({ ...draft })
  }

  const onReset = () => {
    setPage(1)
    setDraft(initialFilters)
    setFilters(initialFilters)
  }

  const onExport = async () => {
    try {
      const blob = await aiLogsApi.exportJsonl(filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ai-train-${dayjs().format('YYYYMMDD-HHmmss')}.jsonl`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      message.error(e?.message || '导出失败')
    }
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '用户',
      dataIndex: 'nickname',
      width: 160,
      render: (_: string, record: AiLogItem) => (
        <Space direction="vertical" size={0}>
          <Text>{record.nickname || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.email || ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model',
      width: 140,
      render: (value: string) => <Text>{value || '默认'}</Text>,
    },
    {
      title: '会话',
      dataIndex: 'sessionId',
      width: 140,
      render: (value: string) => <Text type="secondary">{value || '-'}</Text>,
    },
    {
      title: '摘要',
      dataIndex: 'preview',
      render: (_: any, record: AiLogItem) => (
        <Space direction="vertical" size={4}>
          <Text>
            <Text type="secondary">用户：</Text>
            {record.preview?.user || '—'}
          </Text>
          <Text>
            <Text type="secondary">助手：</Text>
            {record.preview?.assistant || '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (_: any, record: AiLogItem) => (
        <Button size="small" onClick={() => setActive(record)}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Title level={2} style={{ margin: 0 }}>
            AI 问答记录
          </Title>
          <Tag color="blue">已脱敏</Tag>
          <Text type="secondary">自动保留 180 天</Text>
        </Space>
        <Button type="primary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={onExport}>
          导出 JSONL
        </Button>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            placeholder="关键词"
            value={draft.keyword}
            onChange={e => setDraft(prev => ({ ...prev, keyword: e.target.value }))}
            allowClear
            style={{ width: 200 }}
          />
          <Input
            placeholder="模型"
            value={draft.model}
            onChange={e => setDraft(prev => ({ ...prev, model: e.target.value }))}
            allowClear
            style={{ width: 200 }}
          />
          <Input
            placeholder="会话ID"
            value={draft.sessionId}
            onChange={e => setDraft(prev => ({ ...prev, sessionId: e.target.value }))}
            allowClear
            style={{ width: 200 }}
          />
          <Input
            placeholder="用户ID"
            value={draft.userId ? String(draft.userId) : ''}
            onChange={e =>
              setDraft(prev => ({
                ...prev,
                userId: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            allowClear
            style={{ width: 160 }}
          />
          <RangePicker
            value={draft.dateRange || undefined}
            onChange={value => setDraft(prev => ({ ...prev, dateRange: value }))}
          />
          <Button type="primary" icon={<Search style={{ width: 16, height: 16 }} />} onClick={onSearch}>
            查询
          </Button>
          <Button onClick={onReset}>重置</Button>
        </Space>
      </Card>

      <Card>
        <Table columns={columns} dataSource={items} rowKey="id" loading={loading} pagination={false} />
        {!loading && (
          <GlobalPagination
            total={total}
            current={page}
            pageSize={pageSize}
            onChange={(next, size) => {
              setPage(next)
              if (size !== pageSize) setPageSize(size)
            }}
            onPageSizeChange={(_, size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        )}
      </Card>

      <Drawer
        title="问答详情"
        open={!!active}
        onClose={() => setActive(null)}
        width={520}
        destroyOnClose
      >
        {active && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space>
              <Text type="secondary">用户：</Text>
              <Text>{active.nickname || '—'}</Text>
              <Text type="secondary">{active.email || ''}</Text>
            </Space>
            <Space>
              <Text type="secondary">模型：</Text>
              <Text>{active.model || '默认'}</Text>
              <Text type="secondary">会话ID：</Text>
              <Text>{active.sessionId || '-'}</Text>
            </Space>
            {Array.isArray(active.messages) && active.messages.length > 0 ? (
              active.messages.map((m, idx) => (
                <Card key={`${active.id}-${idx}`} size="small">
                  <Space direction="vertical" size={6}>
                    <Tag color={m.role === 'assistant' ? 'green' : m.role === 'system' ? 'blue' : 'gold'}>
                      {m.role}
                    </Tag>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{m.content}</Paragraph>
                  </Space>
                </Card>
              ))
            ) : (
              <Text type="secondary">暂无消息</Text>
            )}
            {active.action && (
              <Card size="small">
                <Text type="secondary">执行动作</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {JSON.stringify(active.action, null, 2)}
                </Paragraph>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  )
}
