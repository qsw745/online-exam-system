import { App, Modal, Segmented, Space, Spin, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { workflowsApi, type WorkflowInstanceDetail } from '@/shared/api/endpoints/workflows'
import { workflowStatusLabel } from '@/shared/utils/workflow'
import WorkflowRuntimeView, { RuntimeSummary } from '@/features/workflows/components/WorkflowRuntimeView'
import WorkflowProcessTable from '@/features/workflows/components/WorkflowProcessTable'
import { translate } from '@/shared/utils/i18n'

const { Text, Title } = Typography

const instanceStatusColor = (s?: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'error'
  if (s === 'running') return 'processing'
  if (s === 'canceled') return 'default'
  return 'default'
}

export default function WorkflowInstanceModal({
  instanceId,
  open,
  onClose,
}: {
  instanceId: number | null
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<WorkflowInstanceDetail | null>(null)
  const [view, setView] = useState<'table' | 'timeline'>('table')

  useEffect(() => {
    if (!open || !instanceId) return
    setLoading(true)
    workflowsApi
      .getInstance(instanceId)
      .then(res => setDetail(res))
      .catch(err => message.error(err?.message || translate('papers.wf_load_detail_failed')))
      .finally(() => setLoading(false))
  }, [instanceId, message, open])

  useEffect(() => {
    if (!open) setDetail(null)
  }, [open])

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title={translate('auto.d157b8ac50')}>
      {loading || !detail ? (
        <Spin />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginBottom: 6 }}>
              {detail.template?.name || translate('workflow.col_flow')}
            </Title>
            <Space size="middle" wrap>
              <Tag color={instanceStatusColor(detail.instance?.status)}>
                {workflowStatusLabel(detail.instance?.status)}
              </Tag>
              <Text type="secondary">{translate('workflow.col_entity')}</Text>
              <Tag bordered={false}>{detail.instance?.entity_type}</Tag>
              <Text type="secondary">{translate('auto.9f42dac67e')}</Text>
              <Tag bordered={false}>{detail.instance?.entity_id}</Tag>
            </Space>
          </div>

          <RuntimeSummary detail={detail} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Segmented
              size="small"
              value={view}
              onChange={v => setView(v as 'table' | 'timeline')}
              options={[
                { label: translate('richTextEditor.table'), value: 'table' },
                { label: translate('auto.4f8ef92599'), value: 'timeline' },
              ]}
            />
          </div>

          {view === 'table' ? (
            <WorkflowProcessTable tasks={detail.tasks || []} />
          ) : (
            <WorkflowRuntimeView detail={detail} showSummary={false} />
          )}
        </Space>
      )}
    </Modal>
  )
}
