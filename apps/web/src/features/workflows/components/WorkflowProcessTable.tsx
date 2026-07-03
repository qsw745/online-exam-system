import { useMemo } from 'react'
import { Empty, Table, Tag, Typography } from 'antd'
import type { WorkflowTask } from '@/shared/api/endpoints/workflows'
import { workflowStatusLabel } from '@/shared/utils/workflow'
import { formatDateTime } from '@/shared/utils/datetime'
import { taskDurationText } from '@/features/workflows/components/WorkflowRuntimeView'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

const statusColor = (s?: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'pending') return 'processing'
  if (s === 'canceled') return 'default'
  return 'default'
}

/** 处理过程明细表：节点 / 处理人 / 状态 / 意见 / 处理时间 / 耗时 */
export default function WorkflowProcessTable({ tasks }: { tasks: WorkflowTask[] }) {
  const now = Date.now()
  const rows = useMemo(
    () =>
      [...(tasks || [])].sort((a, b) => {
        const at = new Date(String(a.created_at || '').replace(' ', 'T')).getTime()
        const bt = new Date(String(b.created_at || '').replace(' ', 'T')).getTime()
        return (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0)
      }),
    [tasks]
  )

  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={translate('auto.682b9023c4')} />

  const columns = [
    { title: translate('workflow.col_node'), dataIndex: 'node_name', key: 'node_name', width: 130, ellipsis: true },
    {
      title: translate('auto.3e132a2a8e'),
      dataIndex: 'assignee_name',
      key: 'assignee',
      width: 130,
      ellipsis: true,
      render: (_: any, r: WorkflowTask) => r.assignee_name || `用户#${r.assignee_id}`,
    },
    {
      title: translate('users.columns.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={statusColor(v)}>{workflowStatusLabel(v)}</Tag>,
    },
    {
      title: translate('auto.801ab0896b'),
      dataIndex: 'comment',
      key: 'comment',
      render: (v: string) =>
        v ? (
          <Text style={{ whiteSpace: 'pre-wrap' }}>{v}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: translate('auto.f42bdf4f95'),
      key: 'time',
      width: 170,
      render: (_: any, r: WorkflowTask) => {
        const t = formatDateTime(r.decided_at || r.created_at)
        return t ? <Text type="secondary">{t}</Text> : <Text type="secondary">—</Text>
      },
    },
    {
      title: translate('auto.a9704e1997'),
      key: 'duration',
      width: 110,
      render: (_: any, r: WorkflowTask) => {
        const d = taskDurationText(r, now)
        return d ? <Text type="secondary">{d}</Text> : <Text type="secondary">—</Text>
      },
    },
  ]

  return (
    <Table
      rowKey="id"
      size="small"
      columns={columns as any}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 720 }}
    />
  )
}
