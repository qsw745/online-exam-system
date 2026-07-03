import { App, Button, Card, Popconfirm, Space, Table, Tabs, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  workflowsApi,
  type WorkflowInstance,
  type WorkflowTask,
} from '@/shared/api/endpoints/workflows'
import { workflowStatusLabel } from '@/shared/utils/workflow'
import { formatDateTime } from '@/shared/utils/datetime'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import WorkflowInstanceModal from '@/features/workflows/components/WorkflowInstanceModal'
import WorkflowTaskDecisionModal from '@/features/workflows/components/WorkflowTaskDecisionModal'

const { Title, Text } = Typography

const statusColor = (s?: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'pending' || s === 'running') return 'processing'
  if (s === 'canceled') return 'default'
  return 'default'
}

const entityPath = (entityType?: string, entityId?: number) => {
  if (entityType === 'paper') return { labelKey: 'workflow.entity_paper', path: `/admin/paper-detail/${entityId}` }
  if (entityType === 'exam') return { labelKey: 'workflow.entity_exam', path: `/exam/${entityId}` }
  return null
}

export default function WorkflowTasksPage() {
  const { t } = useLanguage()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pending' | 'processed' | 'mine'>('pending')
  const [instanceId, setInstanceId] = useState<number | null>(null)
  const [decisionTask, setDecisionTask] = useState<WorkflowTask | null>(null)

  // 共享分页（每个 tab 独立刷新）
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
      const res = await workflowsApi.listMyTasks({ status: 'pending', page: pending.page, limit: pending.limit })
      setPending(s => ({ ...s, items: res.items || [], total: res.total }))
    } catch (e: any) {
      message.error(e?.message || t('workflow.msg_load_pending_failed'))
    } finally {
      setPending(s => ({ ...s, loading: false }))
    }
  }, [message, pending.page, pending.limit])

  const loadProcessed = useCallback(async () => {
    setProcessed(s => ({ ...s, loading: true }))
    try {
      const res = await workflowsApi.listMyTasks({ status: 'processed', page: processed.page, limit: processed.limit })
      setProcessed(s => ({ ...s, items: res.items || [], total: res.total }))
    } catch (e: any) {
      message.error(e?.message || t('workflow.msg_load_processed_failed'))
    } finally {
      setProcessed(s => ({ ...s, loading: false }))
    }
  }, [message, processed.page, processed.limit])

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
  }, [message, mine.page, mine.limit])

  useEffect(() => {
    if (tab === 'pending') loadPending()
    if (tab === 'processed') loadProcessed()
    if (tab === 'mine') loadMine()
  }, [tab, loadPending, loadProcessed, loadMine])

  const reloadActive = () => {
    if (tab === 'pending') loadPending()
    if (tab === 'processed') loadProcessed()
    if (tab === 'mine') loadMine()
  }

  const withdraw = async (id: number) => {
    try {
      await workflowsApi.withdrawInstance(id)
      message.success(t('workflow.msg_withdrawn'))
      loadMine()
    } catch (e: any) {
      message.error(e?.message || t('workflow.msg_withdraw_failed'))
    }
  }

  const taskColumns = (withActions: boolean) => [
    { title: t('workflow.col_entity'), dataIndex: 'entity_type', key: 'entity_type', width: 90 },
    { title: t('workflow.col_entity_id'), dataIndex: 'entity_id', key: 'entity_id', width: 90 },
    { title: t('workflow.col_node'), dataIndex: 'node_name', key: 'node_name' },
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
    { title: t('workflow.col_time'), dataIndex: 'created_at', key: 'created_at', width: 170, render: (v?: string) => (v ? formatDateTime(v) : '-') },
    {
      title: t('workflow.col_actions'),
      key: 'actions',
      width: 220,
      render: (_: any, row: WorkflowTask) => {
        const entity = entityPath(row.entity_type, row.entity_id)
        return (
          <Space>
            {withActions && row.status === 'pending' && (
              <Button type="link" onClick={() => setDecisionTask(row)}>
                {t('workflow.btn_process')}
              </Button>
            )}
            <Button type="link" onClick={() => setInstanceId(row.instance_id)}>
              {t('workflow.btn_view_flow')}
            </Button>
            {entity?.path && (
              <Button type="link" onClick={() => navigate(entity.path)}>
                {t('workflow.btn_view')} {t(entity.labelKey)}
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  const mineColumns = useMemo(
    () => [
      { title: t('workflow.col_flow'), dataIndex: 'template_name', key: 'template_name', render: (v: string) => v || '—' },
      { title: t('workflow.col_entity'), dataIndex: 'entity_type', key: 'entity_type', width: 90 },
      { title: t('workflow.col_entity_id'), dataIndex: 'entity_id', key: 'entity_id', width: 90 },
      {
        title: t('workflow.col_status'),
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (v: string) => <Tag color={statusColor(v)}>{workflowStatusLabel(v)}</Tag>,
      },
      { title: t('workflow.col_created_at'), dataIndex: 'created_at', key: 'created_at', width: 170, render: (v?: string) => (v ? formatDateTime(v) : '-') },
      {
        title: t('workflow.col_actions'),
        key: 'actions',
        width: 200,
        render: (_: any, row: WorkflowInstance) => (
          <Space>
            <Button type="link" onClick={() => setInstanceId(row.id)}>
              {t('workflow.btn_view_flow')}
            </Button>
            {row.status === 'running' && (
              <Popconfirm title={t('workflow.confirm_withdraw')} okText={t('workflow.btn_withdraw')} cancelText={t('app.cancel')} onConfirm={() => withdraw(row.id)}>
                <Button type="link" danger>
                  {t('workflow.btn_withdraw')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [t]
  )

  const pendingPagination = createTablePaginationConfig({
    current: pending.page,
    pageSize: pending.limit,
    total: pending.total,
    onChange: (p, ps) => {
      const next = resolvePaginationChange(p, ps, pending.limit)
      setPending(s => ({ ...s, page: next.page, limit: next.pageSize }))
    },
  })
  const processedPagination = createTablePaginationConfig({
    current: processed.page,
    pageSize: processed.limit,
    total: processed.total,
    onChange: (p, ps) => {
      const next = resolvePaginationChange(p, ps, processed.limit)
      setProcessed(s => ({ ...s, page: next.page, limit: next.pageSize }))
    },
  })
  const minePagination = createTablePaginationConfig({
    current: mine.page,
    pageSize: mine.limit,
    total: mine.total,
    onChange: (p, ps) => {
      const next = resolvePaginationChange(p, ps, mine.limit)
      setMine(s => ({ ...s, page: next.page, limit: next.pageSize }))
    },
  })

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
          onChange={k => setTab(k as typeof tab)}
          items={[
            {
              key: 'pending',
              label: t('workflow.tab_pending'),
              children: (
                <Table
                  rowKey="id"
                  loading={pending.loading}
                  columns={taskColumns(true) as any}
                  dataSource={pending.items}
                  pagination={pendingPagination}
                />
              ),
            },
            {
              key: 'processed',
              label: t('workflow.tab_processed'),
              children: (
                <Table
                  rowKey="id"
                  loading={processed.loading}
                  columns={taskColumns(false) as any}
                  dataSource={processed.items}
                  pagination={processedPagination}
                />
              ),
            },
            {
              key: 'mine',
              label: t('workflow.tab_mine'),
              children: (
                <Table
                  rowKey="id"
                  loading={mine.loading}
                  columns={mineColumns as any}
                  dataSource={mine.items}
                  pagination={minePagination}
                />
              ),
            },
          ]}
        />
      </Card>
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
