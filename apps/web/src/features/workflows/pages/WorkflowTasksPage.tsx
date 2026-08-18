import { CheckOutlined, CloseOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { App, Badge, Button, Card, Empty, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  workflowsApi,
  type WorkflowInstance,
  type WorkflowTask,
} from '@/shared/api/endpoints/workflows'
import { workflowEntityLabelKey, workflowStatusLabel } from '@/shared/utils/workflow'
import { formatDateTime } from '@/shared/utils/datetime'
import dayjs from '@/shared/utils/dayjs'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import WorkflowInstanceModal from '@/features/workflows/components/WorkflowInstanceModal'
import WorkflowTaskDecisionModal from '@/features/workflows/components/WorkflowTaskDecisionModal'

const { Title, Text } = Typography
const { TextArea } = Input

type TabKey = 'pending' | 'processed' | 'mine'

const statusColor = (s?: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'pending' || s === 'running') return 'processing'
  if (s === 'canceled') return 'default'
  return 'default'
}

const entityPath = (entityType?: string, entityId?: number) => {
  if (entityType === 'paper') return `/admin/paper-detail/${entityId}`
  if (entityType === 'exam') return `/exam/${entityId}`
  return null
}

/** 停留时长：超过 3 天标红提醒 */
const AGING_WARN_DAYS = 3

export default function WorkflowTasksPage() {
  const { t } = useLanguage()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('pending')
  const [instanceId, setInstanceId] = useState<number | null>(null)
  const [decisionTask, setDecisionTask] = useState<WorkflowTask | null>(null)

  // 筛选（三个 tab 共用）
  const [keyword, setKeyword] = useState('')
  const [entityType, setEntityType] = useState<string | undefined>(undefined)

  // 批量审批
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [bulk, setBulk] = useState<{ open: boolean; action: 'approve' | 'reject' }>({ open: false, action: 'approve' })
  const [bulkComment, setBulkComment] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  const [pending, setPending] = useState<{ items: WorkflowTask[]; total: number; page: number; limit: number; loading: boolean }>({
    items: [], total: 0, page: 1, limit: 10, loading: false,
  })
  const [processed, setProcessed] = useState<{ items: WorkflowTask[]; total: number; page: number; limit: number; loading: boolean }>({
    items: [], total: 0, page: 1, limit: 10, loading: false,
  })
  const [mine, setMine] = useState<{ items: WorkflowInstance[]; total: number; page: number; limit: number; loading: boolean }>({
    items: [], total: 0, page: 1, limit: 10, loading: false,
  })

  const loadPending = useCallback(async () => {
    setPending(s => ({ ...s, loading: true }))
    try {
      const res = await workflowsApi.listMyTasks({
        status: 'pending',
        page: pending.page,
        limit: pending.limit,
        entity_type: entityType,
      })
      setPending(s => ({ ...s, items: res.items || [], total: res.total }))
    } catch (e: any) {
      message.error(e?.message || t('workflow.msg_load_pending_failed'))
    } finally {
      setPending(s => ({ ...s, loading: false }))
    }
  }, [message, t, entityType, pending.page, pending.limit])

  const loadProcessed = useCallback(async () => {
    setProcessed(s => ({ ...s, loading: true }))
    try {
      const res = await workflowsApi.listMyTasks({
        status: 'processed',
        page: processed.page,
        limit: processed.limit,
        entity_type: entityType,
      })
      setProcessed(s => ({ ...s, items: res.items || [], total: res.total }))
    } catch (e: any) {
      message.error(e?.message || t('workflow.msg_load_processed_failed'))
    } finally {
      setProcessed(s => ({ ...s, loading: false }))
    }
  }, [message, t, entityType, processed.page, processed.limit])

  const loadMine = useCallback(async () => {
    setMine(s => ({ ...s, loading: true }))
    try {
      const res = await workflowsApi.listMyInstances({ page: mine.page, limit: mine.limit })
      setMine(s => ({ ...s, items: res.items || [], total: res.total }))
    } catch (e: any) {
      message.error(e?.message || t('workflow.msg_load_mine_failed'))
    } finally {
      setMine(s => ({ ...s, loading: false }))
    }
  }, [message, t, mine.page, mine.limit])

  useEffect(() => {
    if (tab === 'pending') loadPending()
    if (tab === 'processed') loadProcessed()
    if (tab === 'mine') loadMine()
  }, [tab, loadPending, loadProcessed, loadMine])

  const reloadActive = useCallback(() => {
    setSelectedKeys([])
    if (tab === 'pending') loadPending()
    if (tab === 'processed') loadProcessed()
    if (tab === 'mine') loadMine()
  }, [tab, loadPending, loadProcessed, loadMine])

  const withdraw = useCallback(
    async (id: number) => {
      try {
        await workflowsApi.withdrawInstance(id)
        message.success(t('workflow.msg_withdrawn'))
        loadMine()
      } catch (e: any) {
        message.error(e?.message || t('workflow.msg_withdraw_failed'))
      }
    },
    [message, t, loadMine]
  )

  // 关键词为前端过滤：接口未提供搜索参数
  const matchKeyword = useCallback(
    (fields: Array<string | number | undefined | null>) => {
      const kw = keyword.trim().toLowerCase()
      if (!kw) return true
      return fields.some(f => String(f ?? '').toLowerCase().includes(kw))
    },
    [keyword]
  )

  const pendingRows = useMemo(
    () => pending.items.filter(r => matchKeyword([r.node_name, r.entity_type, r.entity_id, r.assignee_name])),
    [pending.items, matchKeyword]
  )
  const processedRows = useMemo(
    () => processed.items.filter(r => matchKeyword([r.node_name, r.entity_type, r.entity_id, r.comment])),
    [processed.items, matchKeyword]
  )
  const mineRows = useMemo(
    () => mine.items.filter(r => matchKeyword([r.template_name, r.entity_type, r.entity_id, r.status])),
    [mine.items, matchKeyword]
  )

  const entityTag = useCallback(
    (type?: string, id?: number) => {
      const key = workflowEntityLabelKey(type)
      const label = key ? t(key) : type || '-'
      const path = entityPath(type, id)
      const body = (
        <>
          <Tag bordered={false}>{label}</Tag>
          <Text type="secondary">#{id ?? '-'}</Text>
        </>
      )
      if (!path) return <Space size={4}>{body}</Space>
      return (
        <Space size={4}>
          <a onClick={() => navigate(path)}>{body}</a>
        </Space>
      )
    },
    [t, navigate]
  )

  const agingCell = useCallback(
    (value?: string) => {
      if (!value) return '-'
      const d = dayjs(value)
      if (!d.isValid()) return '-'
      const days = dayjs().diff(d, 'day')
      return (
        <Tooltip title={formatDateTime(value)}>
          <span style={{ color: days >= AGING_WARN_DAYS ? '#ef4444' : undefined }}>{d.fromNow()}</span>
        </Tooltip>
      )
    },
    []
  )

  const taskColumns = useCallback(
    (withActions: boolean) => [
      {
        title: t('workflow.col_entity'),
        key: 'entity',
        width: 150,
        render: (_: any, row: WorkflowTask) => entityTag(row.entity_type, row.entity_id),
      },
      { title: t('workflow.col_node'), dataIndex: 'node_name', key: 'node_name', ellipsis: true },
      {
        title: t('workflow.col_task_status'),
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (v: string) => <Tag color={statusColor(v)}>{workflowStatusLabel(v)}</Tag>,
      },
      {
        title: t('workflow.col_instance_status'),
        dataIndex: 'instance_status',
        key: 'instance_status',
        width: 110,
        render: (v: string) => <Tag color={statusColor(v)}>{workflowStatusLabel(v)}</Tag>,
      },
      {
        title: withActions ? t('workflow.col_waiting') : t('workflow.col_time'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 150,
        render: (v?: string) => agingCell(v),
      },
      {
        title: t('workflow.col_actions'),
        key: 'actions',
        width: 160,
        render: (_: any, row: WorkflowTask) => (
          <Space size={0}>
            {withActions && row.status === 'pending' && (
              <Button type="link" onClick={() => setDecisionTask(row)}>
                {t('workflow.btn_process')}
              </Button>
            )}
            <Button type="link" onClick={() => setInstanceId(row.instance_id)}>
              {t('workflow.btn_view_flow')}
            </Button>
          </Space>
        ),
      },
    ],
    [t, entityTag, agingCell]
  )

  const mineColumns = useMemo(
    () => [
      { title: t('workflow.col_flow'), dataIndex: 'template_name', key: 'template_name', ellipsis: true, render: (v: string) => v || '—' },
      {
        title: t('workflow.col_entity'),
        key: 'entity',
        width: 150,
        render: (_: any, row: WorkflowInstance) => entityTag(row.entity_type, row.entity_id),
      },
      {
        title: t('workflow.col_status'),
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (v: string) => <Tag color={statusColor(v)}>{workflowStatusLabel(v)}</Tag>,
      },
      { title: t('workflow.col_created_at'), dataIndex: 'created_at', key: 'created_at', width: 150, render: (v?: string) => agingCell(v) },
      {
        title: t('workflow.col_actions'),
        key: 'actions',
        width: 170,
        render: (_: any, row: WorkflowInstance) => (
          <Space size={0}>
            <Button type="link" onClick={() => setInstanceId(row.id)}>
              {t('workflow.btn_view_flow')}
            </Button>
            {row.status === 'running' && (
              <Popconfirm
                title={t('workflow.confirm_withdraw')}
                okText={t('workflow.btn_withdraw')}
                cancelText={t('app.cancel')}
                onConfirm={() => withdraw(row.id)}
              >
                <Button type="link" danger>
                  {t('workflow.btn_withdraw')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [t, entityTag, agingCell, withdraw]
  )

  // 关键词是前端过滤（接口无搜索参数），此时分页总数按过滤结果显示，
  // 否则会出现「0 行却写着共 N 条」的矛盾
  const hasKeyword = keyword.trim().length > 0

  const pendingPagination = createTablePaginationConfig({
    current: pending.page,
    pageSize: pending.limit,
    total: hasKeyword ? pendingRows.length : pending.total,
    onChange: (p, ps) => {
      const next = resolvePaginationChange(p, ps, pending.limit)
      setPending(s => ({ ...s, page: next.page, limit: next.pageSize }))
    },
  })
  const processedPagination = createTablePaginationConfig({
    current: processed.page,
    pageSize: processed.limit,
    total: hasKeyword ? processedRows.length : processed.total,
    onChange: (p, ps) => {
      const next = resolvePaginationChange(p, ps, processed.limit)
      setProcessed(s => ({ ...s, page: next.page, limit: next.pageSize }))
    },
  })
  const minePagination = createTablePaginationConfig({
    current: mine.page,
    pageSize: mine.limit,
    total: hasKeyword ? mineRows.length : mine.total,
    onChange: (p, ps) => {
      const next = resolvePaginationChange(p, ps, mine.limit)
      setMine(s => ({ ...s, page: next.page, limit: next.pageSize }))
    },
  })

  const runBulk = async () => {
    const ids = [...selectedKeys]
    if (!ids.length) return
    setBulkLoading(true)
    try {
      const results = await Promise.allSettled(
        ids.map(id =>
          bulk.action === 'approve'
            ? workflowsApi.approveTask(id, { comment: bulkComment || undefined })
            : workflowsApi.rejectTask(id, { comment: bulkComment || undefined })
        )
      )
      const ok = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - ok
      if (failed > 0) {
        message.warning(t('workflow.msg_bulk_partial').replace('{ok}', String(ok)).replace('{failed}', String(failed)))
      } else {
        message.success(t('workflow.msg_bulk_done').replace('{ok}', String(ok)))
      }
      setBulk(s => ({ ...s, open: false }))
      setBulkComment('')
      setSelectedKeys([])
      loadPending()
    } finally {
      setBulkLoading(false)
    }
  }

  const emptyText = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workflow.empty_tasks')} />

  const toolbar = (
    <Space size={8} wrap>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder={t('workflow.search_placeholder')}
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        style={{ width: 220 }}
      />
      <Select
        allowClear
        value={entityType}
        onChange={v => setEntityType(v)}
        placeholder={t('workflow.filter_entity')}
        style={{ width: 140 }}
        options={[
          { value: 'paper', label: t('workflow.entity_paper') },
          { value: 'exam', label: t('workflow.entity_exam') },
        ]}
      />
      <Tooltip title={t('app.refresh')}>
        <Button icon={<ReloadOutlined />} onClick={reloadActive} />
      </Tooltip>
    </Space>
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={4} style={{ marginBottom: 0 }}>
          {t('workflow.task_center')}
        </Title>
        <Text type="secondary">{t('workflow.task_center_desc')}</Text>
      </Card>
      <Card>
        <Tabs
          activeKey={tab}
          onChange={k => {
            setTab(k as TabKey)
            setSelectedKeys([])
          }}
          tabBarExtraContent={toolbar}
          items={[
            {
              key: 'pending',
              label: (
                <Badge count={pending.total} size="small" offset={[8, -2]}>
                  <span>{t('workflow.tab_pending')}</span>
                </Badge>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {selectedKeys.length > 0 && (
                    <Space size={8} wrap>
                      <Text type="secondary">
                        {t('workflow.selected_count').replace('{n}', String(selectedKeys.length))}
                      </Text>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => setBulk({ open: true, action: 'approve' })}
                      >
                        {t('workflow.btn_bulk_approve')}
                      </Button>
                      <Button danger icon={<CloseOutlined />} onClick={() => setBulk({ open: true, action: 'reject' })}>
                        {t('workflow.btn_bulk_reject')}
                      </Button>
                      <Button type="link" onClick={() => setSelectedKeys([])}>
                        {t('workflow.btn_clear_selection')}
                      </Button>
                    </Space>
                  )}
                  <Table
                    rowKey="id"
                    size="middle"
                    loading={pending.loading}
                    columns={taskColumns(true) as any}
                    dataSource={pendingRows}
                    pagination={pendingPagination}
                    locale={{ emptyText }}
                    rowSelection={{
                      selectedRowKeys: selectedKeys,
                      onChange: keys => setSelectedKeys(keys as number[]),
                      getCheckboxProps: (row: WorkflowTask) => ({ disabled: row.status !== 'pending' }),
                    }}
                  />
                </Space>
              ),
            },
            {
              key: 'processed',
              label: t('workflow.tab_processed'),
              children: (
                <Table
                  rowKey="id"
                  size="middle"
                  loading={processed.loading}
                  columns={taskColumns(false) as any}
                  dataSource={processedRows}
                  pagination={processedPagination}
                  locale={{ emptyText }}
                />
              ),
            },
            {
              key: 'mine',
              label: t('workflow.tab_mine'),
              children: (
                <Table
                  rowKey="id"
                  size="middle"
                  loading={mine.loading}
                  columns={mineColumns as any}
                  dataSource={mineRows}
                  pagination={minePagination}
                  locale={{ emptyText }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={bulk.open}
        title={bulk.action === 'approve' ? t('workflow.btn_bulk_approve') : t('workflow.btn_bulk_reject')}
        okText={t('app.confirm')}
        cancelText={t('app.cancel')}
        confirmLoading={bulkLoading}
        onOk={runBulk}
        onCancel={() => setBulk(s => ({ ...s, open: false }))}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text>{t('workflow.bulk_confirm').replace('{n}', String(selectedKeys.length))}</Text>
          <TextArea
            rows={3}
            value={bulkComment}
            onChange={e => setBulkComment(e.target.value)}
            placeholder={t('workflow.bulk_comment_placeholder')}
          />
        </Space>
      </Modal>

      <WorkflowInstanceModal open={Boolean(instanceId)} instanceId={instanceId} onClose={() => setInstanceId(null)} />
      <WorkflowTaskDecisionModal
        open={Boolean(decisionTask)}
        task={decisionTask}
        onClose={() => setDecisionTask(null)}
        onDone={() => reloadActive()}
      />
    </Space>
  )
}
