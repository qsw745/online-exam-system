import { App, Button, Card, Descriptions, Input, Modal, Space, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowsApi, type WorkflowTask } from '@/shared/api/endpoints/workflows'
import { workflowStatusLabel } from '@/shared/utils/workflow'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import WorkflowInstanceModal from '@/features/workflows/components/WorkflowInstanceModal'
import WorkflowTaskDecisionModal from '@/features/workflows/components/WorkflowTaskDecisionModal'

const { Title, Text } = Typography
const { TextArea } = Input

const statusColor = (s: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'pending') return 'warning'
  return 'default'
}

export default function ExamReviewPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<WorkflowTask[]>([])
  const [rawItems, setRawItems] = useState<WorkflowTask[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [formPayload, setFormPayload] = useState<Record<string, any> | null>(null)
  const [instanceId, setInstanceId] = useState<number | null>(null)
  const [decisionTask, setDecisionTask] = useState<WorkflowTask | null>(null)

  const dedupeTasks = (list: WorkflowTask[]) => {
    const map = new Map<number, WorkflowTask[]>()
    for (const item of list) {
      const key = Number(item.instance_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    const pick = (items: WorkflowTask[]) => {
      const pending = items.find(i => i.status === 'pending')
      if (pending) return pending
      return items
        .slice()
        .sort((a, b) => {
          const at = new Date(a.decided_at || a.created_at || '').getTime()
          const bt = new Date(b.decided_at || b.created_at || '').getTime()
          return bt - at
        })[0]
    }
    return Array.from(map.values())
      .map(pick)
      .filter(Boolean)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workflowsApi.listMyTasks({ page, limit, entity_type: 'exam' })
      const nextItems = dedupeTasks(res.items || [])
      setRawItems(res.items || [])
      setItems(nextItems)
      setTotal(nextItems.length)
    } catch (e: any) {
      message.error(e?.message || '加载审批列表失败')
    } finally {
      setLoading(false)
    }
  }, [limit, message, page])

  useEffect(() => {
    load()
  }, [load])

  const handlePaginationChange = (nextPage: number, nextLimit?: number) => {
    const next = resolvePaginationChange(nextPage, nextLimit, limit)
    setPage(next.page)
    setLimit(next.pageSize)
  }

  const getEntityPath = (row: WorkflowTask) => {
    if (row.entity_type === 'paper') return { label: '试卷', path: `/admin/paper-detail/${row.entity_id}` }
    if (row.entity_type === 'exam') return { label: '考试', path: `/exam/${row.entity_id}` }
    return null
  }

  const pendingByInstance = useMemo(() => {
    const map = new Map<number, WorkflowTask>()
    for (const item of rawItems) {
      if (item.status !== 'pending') continue
      const key = Number(item.instance_id)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, item)
        continue
      }
      const at = new Date(item.created_at || '').getTime()
      const bt = new Date(existing.created_at || '').getTime()
      if (at > bt) map.set(key, item)
    }
    return map
  }, [rawItems])

  const columns = useMemo(
    () => [
      { title: '考试ID', dataIndex: 'entity_id', key: 'entity_id', width: 90 },
      { title: '节点', dataIndex: 'node_name', key: 'node_name' },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (val: string) => <Tag color={statusColor(val)}>{workflowStatusLabel(val)}</Tag>,
      },
      {
        title: '进度',
        key: 'progress',
        width: 140,
        render: (_: any, row: WorkflowTask) => <Text>{workflowStatusLabel(row.instance_status)}</Text>,
      },
      {
        title: '我的状态',
        dataIndex: 'status',
        key: 'my_status',
        width: 120,
        render: (val: string) => <Tag>{workflowStatusLabel(val)}</Tag>,
      },
      {
        title: '表单',
        key: 'form_values',
        width: 140,
        render: (_: any, row: WorkflowTask) =>
          row.payload?.form_values ? (
            <Button type="link" onClick={() => setFormPayload(row.payload?.form_values)}>
              查看表单
            </Button>
          ) : (
            <Text type="secondary">无</Text>
          ),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
      },
      {
        title: '操作',
        key: 'actions',
        width: 320,
        render: (_: any, row: WorkflowTask) => {
          const pendingTask = pendingByInstance.get(Number(row.instance_id))
          const disabled = !pendingTask
          const entity = getEntityPath(row)
          return (
            <Space>
              <Button
                type="link"
                disabled={disabled}
                onClick={() => {
                  if (pendingTask) {
                    setDecisionTask(pendingTask)
                  } else {
                    message.info('当前没有待处理任务')
                  }
                }}
              >
                处理
              </Button>
              <Button type="link" onClick={() => setInstanceId(row.instance_id)}>
                查看流程
              </Button>
              {entity?.path && (
                <Button type="link" onClick={() => navigate(entity.path)}>
                  查看{entity.label}
                </Button>
              )}
            </Space>
          )
        },
      },
    ],
    [getEntityPath, message, navigate, pendingByInstance]
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Title level={4} style={{ marginBottom: 0 }}>
          考试审核
        </Title>
        <Text type="secondary">需要你审核的考试审批流</Text>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={items}
          pagination={createTablePaginationConfig({
            current: page,
            pageSize: limit,
            total,
            onChange: handlePaginationChange,
          })}
        />
      </Card>
      <Modal
        open={Boolean(formPayload)}
        title="审批表单"
        onCancel={() => setFormPayload(null)}
        footer={[
          <Button key="close" onClick={() => setFormPayload(null)}>
            关闭
          </Button>,
        ]}
      >
        {formPayload ? (
          <Descriptions column={1} bordered size="small">
            {Object.entries(formPayload).map(([key, value]) => (
              <Descriptions.Item label={key} key={key}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : (
          <Text type="secondary">无表单数据</Text>
        )}
      </Modal>
      <WorkflowInstanceModal open={Boolean(instanceId)} instanceId={instanceId} onClose={() => setInstanceId(null)} />
      <WorkflowTaskDecisionModal
        open={Boolean(decisionTask)}
        task={decisionTask}
        onClose={() => setDecisionTask(null)}
        onDone={() => load()}
      />
    </Space>
  )
}
