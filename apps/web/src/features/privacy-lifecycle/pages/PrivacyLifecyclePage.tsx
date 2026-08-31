import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRef, useState } from 'react'

import Forbidden403 from '@/app/errors/Forbidden403'
import type { DataRegion } from '@/platform/region/accountRegion'
import { readPreferredDataRegion } from '@/platform/region/accountRegion'
import {
  privacyLifecycleApi,
  type LifecycleAdminRequest,
  type LifecycleAdminStep,
  type LifecycleDryRun,
  type PrivacyLifecycleApi,
  type RetentionHoldPayload,
} from '@/shared/api/endpoints/privacyLifecycle'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useIsMobile } from '@/shared/hooks/useMobile'
import { translate } from '@/shared/utils/i18n'
import LifecycleRequestDrawer from '../components/LifecycleRequestDrawer'
import RetentionHoldModal from '../components/RetentionHoldModal'
import { lifecycleStatusPresentation } from '../domain/lifecyclePresentation'
import { usePrivacyLifecycle } from '../hooks/usePrivacyLifecycle'

const { Text, Title } = Typography

type PauseValues = { reason: string; reviewAt: string }
type PausePayload = PauseValues & { operationId: string }

const createOperationId = () => {
  if (!globalThis.crypto?.randomUUID) throw new Error('当前环境不支持安全操作编号')
  return globalThis.crypto.randomUUID()
}

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function AuthenticatedPrivacyLifecyclePage(props: Omit<PrivacyLifecyclePageProps, 'currentRole'>) {
  const { user } = useAuth()
  return <PrivacyLifecyclePageContent {...props} currentRole={String(user?.role ?? '')} />
}

export type PrivacyLifecyclePageProps = {
  api?: PrivacyLifecycleApi
  currentRole?: string
  currentRegion?: DataRegion
  mobile?: boolean
}

export default function PrivacyLifecyclePage(props: PrivacyLifecyclePageProps) {
  if (props.currentRole == null) {
    return <AuthenticatedPrivacyLifecyclePage {...props} />
  }
  return <PrivacyLifecyclePageContent {...props} currentRole={props.currentRole} />
}

function PrivacyLifecyclePageContent({
  api = privacyLifecycleApi,
  currentRole,
  currentRegion = readPreferredDataRegion(),
  mobile: mobileOverride,
}: Required<Pick<PrivacyLifecyclePageProps, 'currentRole'>> & Omit<PrivacyLifecyclePageProps, 'currentRole'>) {
  const { message } = App.useApp()
  const detectedMobile = useIsMobile()
  const mobile = mobileOverride ?? detectedMobile
  const authorized = currentRole === 'admin'
  const queue = usePrivacyLifecycle({ api, region: currentRegion, enabled: authorized })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseForm] = Form.useForm<PauseValues>()
  const [pendingPause, setPendingPause] = useState<PausePayload | null>(null)
  const [pendingResumeId, setPendingResumeId] = useState<string | null>(null)
  const [controlFeedback, setControlFeedback] = useState<string | null>(null)
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdId, setHoldId] = useState('')
  const [pendingHold, setPendingHold] = useState<RetentionHoldPayload | null>(null)
  const [holdFeedback, setHoldFeedback] = useState<string | null>(null)
  const [retryingStepId, setRetryingStepId] = useState<string | null>(null)
  const retryOperations = useRef(new Map<string, string>())
  const [previewTarget, setPreviewTarget] = useState<LifecycleAdminRequest | null>(null)
  const [previewConfirmOpen, setPreviewConfirmOpen] = useState(false)
  const [previewResult, setPreviewResult] = useState<LifecycleDryRun | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  if (!authorized) return <Forbidden403 />

  const openDetail = async (item: LifecycleAdminRequest) => {
    setDrawerOpen(true)
    await queue.loadDetail(item.requestId)
  }

  const openPreview = (item: LifecycleAdminRequest) => {
    setPreviewTarget(item)
    setPreviewResult(null)
    setPreviewConfirmOpen(true)
  }

  const runPreview = async () => {
    if (!previewTarget) return
    setPreviewLoading(true)
    try {
      const result = await api.dryRun(previewTarget.requestId)
      setPreviewResult(result)
      setPreviewConfirmOpen(false)
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : translate('privacyLifecycle.error.generic'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const submitPause = async (values: PauseValues) => {
    const payload = pendingPause ?? {
      reason: values.reason,
      reviewAt: new Date(values.reviewAt).toISOString(),
      operationId: createOperationId(),
    }
    setControlFeedback(null)
    try {
      await api.pauseRegion(payload)
      setPendingPause(null)
      setPauseOpen(false)
      pauseForm.resetFields()
      await queue.load()
      message.success(translate('privacyLifecycle.pause.success'))
    } catch (reason: any) {
      const uncertain = reason?.status == null || reason.status >= 500
      if (uncertain) setPendingPause(payload)
      setControlFeedback(uncertain
        ? translate('privacyLifecycle.operation.uncertain')
        : reason?.message || translate('privacyLifecycle.error.generic'))
    }
  }

  const resume = async () => {
    const operationId = pendingResumeId ?? createOperationId()
    try {
      await api.resumeRegion({ operationId })
      setPendingResumeId(null)
      setControlFeedback(null)
      await queue.load()
      message.success(translate('privacyLifecycle.resume.success'))
    } catch (reason: any) {
      const uncertain = reason?.status == null || reason.status >= 500
      if (uncertain) setPendingResumeId(operationId)
      setControlFeedback(uncertain
        ? translate('privacyLifecycle.operation.uncertain')
        : reason?.message || translate('privacyLifecycle.error.generic'))
    }
  }

  const openHold = () => {
    if (!queue.detail) return
    setHoldId(createOperationId())
    setPendingHold(null)
    setHoldFeedback(null)
    setHoldOpen(true)
  }

  const submitHold = async (values: RetentionHoldPayload) => {
    const payload = pendingHold ?? values
    setHoldFeedback(null)
    try {
      await api.createHold(payload)
      setPendingHold(null)
      setHoldOpen(false)
      await Promise.all([queue.load(), queue.detail ? queue.loadDetail(queue.detail.requestId) : Promise.resolve(null)])
      message.success(translate('privacyLifecycle.hold.success'))
    } catch (reason: any) {
      const uncertain = reason?.status == null || reason.status >= 500
      if (uncertain) setPendingHold(payload)
      setHoldFeedback(uncertain
        ? translate('privacyLifecycle.operation.uncertain')
        : reason?.message || translate('privacyLifecycle.error.generic'))
    }
  }

  const retryStep = async (step: LifecycleAdminStep) => {
    const operationId = retryOperations.current.get(step.stepId) ?? createOperationId()
    retryOperations.current.set(step.stepId, operationId)
    setRetryingStepId(step.stepId)
    try {
      await api.retryStep(step.stepId, { operationId })
      retryOperations.current.delete(step.stepId)
      if (queue.detail) await Promise.all([queue.load(), queue.loadDetail(queue.detail.requestId)])
      message.success(translate('privacyLifecycle.retry.success'))
    } catch (reason) {
      queue.setError(reason instanceof Error ? reason.message : translate('privacyLifecycle.error.generic'))
    } finally {
      setRetryingStepId(null)
    }
  }

  const actions = (item: LifecycleAdminRequest) => (
    <Space wrap size={4}>
      <Button size="small" onClick={() => openPreview(item)}>{translate('privacyLifecycle.dryRun', '安全预演')}</Button>
      <Button type="link" size="small" onClick={() => void openDetail(item)}>{translate('privacyLifecycle.view', '查看详情')}</Button>
    </Space>
  )

  const columns: ColumnsType<LifecycleAdminRequest> = [
    { title: translate('privacyLifecycle.field.requestId'), dataIndex: 'requestId', ellipsis: true, width: 230 },
    { title: translate('privacyLifecycle.field.mode'), dataIndex: 'mode', render: value => translate(`privacyLifecycle.mode.${value}`), width: 130 },
    {
      title: translate('privacyLifecycle.field.status'),
      dataIndex: 'status',
      render: value => {
        const view = lifecycleStatusPresentation(value)
        return <Tag color={view.tone}>{translate(view.labelKey)}</Tag>
      },
      width: 150,
    },
    { title: translate('privacyLifecycle.field.oldestAt'), dataIndex: 'requestedAt', render: formatDate, width: 180 },
    { title: translate('privacyLifecycle.field.region'), dataIndex: 'region', render: () => translate(`privacyLifecycle.region.${currentRegion}`), width: 120 },
    { title: translate('privacyLifecycle.field.actions'), key: 'actions', render: (_, item) => actions(item), width: 210 },
  ]

  const counts = {
    active: queue.items.filter(item => !lifecycleStatusPresentation(item.status).terminal).length,
    attention: queue.items.filter(item => item.status === 'ATTENTION_REQUIRED').length,
    held: queue.items.filter(item => item.status === 'HELD').length,
    completed: queue.items.filter(item => lifecycleStatusPresentation(item.status).terminal).length,
  }

  return (
    <Space direction="vertical" size={18} style={{ width: '100%', paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
      <div>
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>{translate('privacyLifecycle.title')}</Title>
            <Text type="secondary">{translate('privacyLifecycle.subtitle')}</Text>
          </div>
          <Tag color="blue">{translate(`privacyLifecycle.region.${currentRegion}`)}</Tag>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        {[
          [translate('privacyLifecycle.count.active'), counts.active],
          [translate('privacyLifecycle.count.attention'), counts.attention],
          [translate('privacyLifecycle.count.held'), counts.held],
          [translate('privacyLifecycle.count.completed'), counts.completed],
        ].map(([label, count]) => (
          <Col xs={12} md={6} key={String(label)}>
            <Card size="small"><Text type="secondary">{label}</Text><Title level={3} style={{ margin: 0 }}>{count}</Title></Card>
          </Col>
        ))}
      </Row>

      <Card size="small">
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Button onClick={() => void queue.load()} loading={queue.loading}>{translate('app.refresh')}</Button>
            <Button danger onClick={() => { setPauseOpen(true); setPendingPause(null); setControlFeedback(null) }}>
              {translate('privacyLifecycle.pause', '暂停本区处理')}
            </Button>
            <Popconfirm
              title={translate('privacyLifecycle.resume.confirmTitle')}
              description={translate('privacyLifecycle.resume.confirmMessage')}
              okText={translate('privacyLifecycle.resume.confirm')}
              cancelText={translate('app.cancel')}
              onConfirm={() => void resume()}
            >
              <Button type="primary">
                {pendingResumeId ? translate('privacyLifecycle.operation.retry') : translate('privacyLifecycle.resume', '恢复本区处理')}
              </Button>
            </Popconfirm>
          </Space>
          <Text type="secondary">{translate('privacyLifecycle.regionReadonly')}</Text>
        </Space>
      </Card>

      {queue.error ? <Alert type="error" showIcon message={queue.error} /> : null}
      {controlFeedback && !pauseOpen ? <Alert type="warning" showIcon message={controlFeedback} /> : null}

      {mobile ? (
        <Space data-testid="lifecycle-mobile-queue" direction="vertical" size={12} style={{ width: '100%' }}>
          {queue.loading ? <Skeleton active /> : queue.items.map(item => {
            const view = lifecycleStatusPresentation(item.status)
            return (
              <Card key={item.requestId} styles={{ body: { padding: 16 } }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text code>{item.requestId.slice(0, 12)}…</Text>
                    <Tag color={view.tone}>{translate(view.labelKey)}</Tag>
                  </Space>
                  <Text>{translate(`privacyLifecycle.mode.${item.mode}`)}</Text>
                  <Text type="secondary">{formatDate(item.requestedAt)}</Text>
                  {actions(item)}
                </Space>
              </Card>
            )
          })}
        </Space>
      ) : (
        <Table
          rowKey="requestId"
          columns={columns}
          dataSource={queue.items}
          loading={queue.loading}
          pagination={false}
          scroll={{ x: 1040 }}
        />
      )}

      <LifecycleRequestDrawer
        open={drawerOpen}
        mobile={mobile}
        loading={queue.detailLoading}
        detail={queue.detail}
        retryingStepId={retryingStepId}
        onClose={() => { setDrawerOpen(false); queue.setDetail(null) }}
        onOpenHold={openHold}
        onRetry={retryStep}
      />

      <RetentionHoldModal
        open={holdOpen}
        holdId={holdId}
        scopeId={queue.detail?.requestId ?? ''}
        uncertain={Boolean(pendingHold)}
        feedback={holdFeedback}
        onCancel={() => { setHoldOpen(false); setPendingHold(null); setHoldFeedback(null) }}
        onSubmit={submitHold}
      />

      <Modal
        open={pauseOpen}
        title={translate('privacyLifecycle.pause.title')}
        footer={null}
        maskClosable={false}
        destroyOnHidden
        onCancel={() => {
          setPauseOpen(false)
          setPendingPause(null)
          setControlFeedback(null)
          pauseForm.resetFields()
        }}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert type="warning" showIcon message={translate('privacyLifecycle.pause.warning')} />
          {controlFeedback ? <Alert type="warning" showIcon message={controlFeedback} /> : null}
          <Form form={pauseForm} layout="vertical" onFinish={submitPause}>
            <Form.Item name="reason" label={translate('privacyLifecycle.pause.reason')} rules={[{ required: true, message: translate('privacyLifecycle.pause.reasonRequired') }, { max: 500 }]}>
              <Input.TextArea rows={3} maxLength={500} disabled={Boolean(pendingPause)} />
            </Form.Item>
            <Form.Item name="reviewAt" label={translate('privacyLifecycle.pause.reviewAt')} rules={[{ required: true, message: translate('privacyLifecycle.pause.reviewAtRequired') }]}>
              <Input type="datetime-local" disabled={Boolean(pendingPause)} />
            </Form.Item>
            <Button danger type="primary" htmlType="submit" block>
              {pendingPause ? translate('privacyLifecycle.operation.retry') : translate('privacyLifecycle.pause.submit')}
            </Button>
          </Form>
        </Space>
      </Modal>

      <Modal
        open={previewConfirmOpen}
        title={translate('privacyLifecycle.dryRun.confirmTitle')}
        confirmLoading={previewLoading}
        okText={translate('privacyLifecycle.dryRun.confirm')}
        cancelText={translate('app.cancel')}
        onOk={() => void runPreview()}
        onCancel={() => setPreviewConfirmOpen(false)}
      >
        <Alert type="info" showIcon message={translate('privacyLifecycle.dryRun.confirmMessage')} />
      </Modal>

      <Modal
        open={Boolean(previewResult)}
        title={translate('privacyLifecycle.dryRun.resultTitle')}
        footer={<Button onClick={() => setPreviewResult(null)}>{translate('app.close')}</Button>}
        onCancel={() => setPreviewResult(null)}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type={previewResult?.coverage.uncoveredColumnCount ? 'warning' : 'success'}
            showIcon
            message={translate('privacyLifecycle.dryRun.aggregateOnly')}
          />
          {previewResult?.categories.map(item => (
            <Card key={`${item.categoryCode}:${item.action}`} size="small">
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text>{translate(`privacyLifecycle.category.${item.categoryCode}`)}</Text>
                <Tag>{translate(`privacyLifecycle.action.${item.action}`)} · {item.count}</Tag>
              </Space>
            </Card>
          ))}
        </Space>
      </Modal>
    </Space>
  )
}
