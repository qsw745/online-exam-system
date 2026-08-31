import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Progress,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  deletionStatusCredentialStore,
  type DeletionStatusCredential,
  type DeletionStatusCredentialStore,
} from '@/platform/account-deletion/deletionStatusCredential'
import {
  accountDeletionApi,
  type AccountDeletionApi,
  type DeletionLifecycleStatus,
  type DeletionStatus,
} from '@/shared/api/endpoints/accountDeletion'
import BrandMark from '@/shared/components/BrandMark'
import { getLang, translate } from '@/shared/utils/i18n'

const { Paragraph, Text, Title } = Typography

type StatusApi = Pick<AccountDeletionApi, 'status' | 'cancel'>
type Verification = { email: string; password: string }

const STATUS_COPY: Record<DeletionLifecycleStatus, 'info' | 'warning' | 'error' | 'success'> = {
  REQUESTED: 'info',
  SCHEDULED: 'warning',
  RUNNING: 'warning',
  HELD: 'warning',
  RETRYING: 'warning',
  ATTENTION_REQUIRED: 'error',
  COMPLETED: 'success',
  COMPLETED_WITH_RESTRICTED_RETENTION: 'success',
  CANCELLED: 'success',
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(getLang(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function AccountDeletionPage({
  api = accountDeletionApi,
  credentialStore = deletionStatusCredentialStore,
}: {
  api?: StatusApi
  credentialStore?: DeletionStatusCredentialStore
}) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [recoveryForm] = Form.useForm<Verification>()
  const [cancelForm] = Form.useForm<Verification>()
  const [credential, setCredential] = useState<DeletionStatusCredential | null>(null)
  const [status, setStatus] = useState<DeletionStatus | null>(null)
  const [checkingCredential, setCheckingCredential] = useState(true)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const loadStatus = async (verification: DeletionStatusCredential | Verification) => {
    setLoading(true)
    setFeedback(null)
    try {
      const result = await api.status(verification)
      if (!result.success) throw new Error(result.error)
      setStatus(result.data)
      return result.data
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : translate('account.deletion.preview_failed'))
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void credentialStore.read()
      .then(async stored => {
        if (!active) return
        setCredential(stored)
        if (stored) await loadStatus(stored)
      })
      .catch(error => {
        if (active) setFeedback(error instanceof Error ? error.message : translate('account.deletion.preview_failed'))
      })
      .finally(() => {
        if (active) setCheckingCredential(false)
      })
    return () => { active = false }
    // 凭证与接口实现由应用启动时确定；页面生命周期内不动态切换。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, credentialStore])

  const activeStatus = status?.status === 'NOT_REQUESTED' || !status ? null : status
  const presentation = activeStatus ? STATUS_COPY[activeStatus.status] : null
  const canCancel = Boolean(
    activeStatus
    && activeStatus.mode === 'GRACE_PERIOD'
    && activeStatus.cancellable
    && (activeStatus.status === 'REQUESTED' || activeStatus.status === 'SCHEDULED')
  )

  const timelineItems = useMemo(() => {
    if (!activeStatus) return []
    const items = [
      { color: 'green', children: <>{translate('account.deletion.submitted_at')} <Text type="secondary">{formatDate(activeStatus.requestedAt)}</Text></> },
      { color: activeStatus.status === 'CANCELLED' ? 'gray' : 'blue', children: <>{translate('account.deletion.execution_at')} <Text type="secondary">{formatDate(activeStatus.scheduledFor)}</Text></> },
    ]
    if (activeStatus.startedAt) {
      items.push({ color: 'blue', children: <>{translate('account.deletion.started_at')} <Text type="secondary">{formatDate(activeStatus.startedAt)}</Text></> })
    }
    if (activeStatus.cancelledAt) {
      items.push({ color: 'gray', children: <>{translate('account.deletion.cancelled_at')} <Text type="secondary">{formatDate(activeStatus.cancelledAt)}</Text></> })
    }
    if (activeStatus.completedAt) {
      items.push({ color: 'green', children: <>{translate('account.deletion.finished_at')} <Text type="secondary">{formatDate(activeStatus.completedAt)}</Text></> })
    }
    return items
  }, [activeStatus])

  const recover = async (values: Verification) => {
    const result = await loadStatus(values)
    if (result?.status === 'NOT_REQUESTED') setFeedback(translate('account.deletion.no_request'))
  }

  const cancel = async (values: Verification) => {
    setLoading(true)
    setFeedback(null)
    try {
      const result = await api.cancel(values)
      if (!result.success) throw new Error(result.error)
      await credentialStore.clear()
      setCredential(null)
      setStatus(result.data)
      setCancelOpen(false)
      cancelForm.resetFields()
      message.success(translate('account.deletion.cancel_success'))
      navigate('/login', { replace: true })
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : translate('account.deletion.preview_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'max(20px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))',
        background: 'linear-gradient(180deg, #f3f7fc 0%, #f8fafc 100%)',
      }}
    >
      <Card styles={{ body: { padding: 'clamp(18px, 5vw, 32px)' } }} style={{ maxWidth: 720, margin: '0 auto', borderRadius: 24 }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space wrap align="center">
            <BrandMark size={44} />
            <Title level={2} style={{ margin: 0 }}>{translate('account.deletion.status_title')}</Title>
          </Space>

          {checkingCredential ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
          {feedback ? <Alert type="error" showIcon message={feedback} closable onClose={() => setFeedback(null)} /> : null}

          {!checkingCredential && activeStatus && presentation ? (
            <>
              <Alert
                type={presentation}
                showIcon
                message={translate(`account.deletion.status.${activeStatus.status}`)}
                description={activeStatus.status === 'COMPLETED_WITH_RESTRICTED_RETENTION'
                  ? translate('account.deletion.restricted_explanation')
                  : undefined}
              />

              <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered>
                <Descriptions.Item label={translate('account.deletion.mode')}>
                  <Tag color={activeStatus.mode === 'IMMEDIATE' ? 'red' : 'blue'}>
                    {activeStatus.mode === 'IMMEDIATE' ? translate('account.deletion.immediate') : translate('account.deletion.grace')}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={translate('account.deletion.region')}>{activeStatus.dataRegion === 'CN' ? translate('account.deletion.region_cn') : translate('account.deletion.region_global')}</Descriptions.Item>
                <Descriptions.Item label={translate('account.deletion.scheduled_at')}>{formatDate(activeStatus.scheduledFor)}</Descriptions.Item>
                <Descriptions.Item label={translate('account.deletion.completed_at')}>{formatDate(activeStatus.completedAt)}</Descriptions.Item>
                {activeStatus.restrictedRetentionUntil ? (
                  <Descriptions.Item label={translate('account.deletion.retained_until')} span={2}>{formatDate(activeStatus.restrictedRetentionUntil)}</Descriptions.Item>
                ) : null}
              </Descriptions>

              <div>
                <Title level={4}>{translate('account.deletion.progress')}</Title>
                <Timeline items={timelineItems} />
              </div>

              {activeStatus.steps.length ? (
                <div>
                  <Title level={4}>{translate('account.deletion.details')}</Title>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {activeStatus.steps.map(step => {
                      const percent = step.plannedCount > 0
                        ? Math.min(100, Math.round((step.processedCount / step.plannedCount) * 100))
                        : step.status === 'COMPLETED' ? 100 : 0
                      return (
                        <Card key={step.stepCode} size="small">
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                              <Text strong>{step.category}</Text>
                              <Space wrap size={4}>
                                <Tag>{translate(`account.deletion.action.${step.action}`)}</Tag>
                                <Tag color={step.status === 'COMPLETED' ? 'green' : step.status === 'ATTENTION_REQUIRED' ? 'red' : 'blue'}>
                                  {translate(`account.deletion.step.${step.status}`)}
                                </Tag>
                              </Space>
                            </Space>
                            <Progress percent={percent} size="small" status={step.status === 'ATTENTION_REQUIRED' ? 'exception' : 'normal'} />
                          </Space>
                        </Card>
                      )
                    })}
                  </Space>
                </div>
              ) : null}

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block loading={loading} onClick={() => credential && void loadStatus(credential)} disabled={!credential}>
                  {translate('account.deletion.refresh')}
                </Button>
                {canCancel ? <Button danger block onClick={() => setCancelOpen(true)}>{translate('account.deletion.cancel')}</Button> : null}
              </Space>
            </>
          ) : null}

          {!checkingCredential && !credential ? (
            <section>
              <Title level={4}>{translate('account.deletion.recovery_title')}</Title>
              <Paragraph type="secondary">
                {translate('account.deletion.recovery_desc')}
              </Paragraph>
              <Form form={recoveryForm} layout="vertical" onFinish={recover}>
                <Form.Item name="email" label={translate('account.deletion.email')} rules={[{ required: true, message: translate('account.deletion.email_required') }, { type: 'email', message: translate('account.deletion.email_invalid') }]}>
                  <Input autoComplete="username" />
                </Form.Item>
                <Form.Item name="password" label={translate('account.deletion.password')} rules={[{ required: true, message: translate('account.deletion.password_required') }]}>
                  <Input.Password autoComplete="current-password" />
                </Form.Item>
                <Button htmlType="submit" block loading={loading}>{translate('account.deletion.query')}</Button>
              </Form>
            </section>
          ) : null}

          <Text type="secondary">{translate('account.deletion.login_prompt')} <Link to="/login">{translate('account.deletion.back_to_login')}</Link></Text>
        </Space>
      </Card>

      <Modal
        open={cancelOpen}
        title={translate('account.deletion.cancel_title')}
        footer={null}
        maskClosable={false}
        destroyOnHidden
        onCancel={() => {
          setCancelOpen(false)
          cancelForm.resetFields()
        }}
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={translate('account.deletion.cancel_warning')}
        />
        <Form form={cancelForm} layout="vertical" onFinish={cancel}>
          <Form.Item name="email" label={translate('account.deletion.email')} rules={[{ required: true, message: translate('account.deletion.email_required') }, { type: 'email', message: translate('account.deletion.email_invalid') }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label={translate('account.deletion.password')} rules={[{ required: true, message: translate('account.deletion.password_required') }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button danger type="primary" htmlType="submit" block loading={loading}>{translate('account.deletion.cancel_submit')}</Button>
        </Form>
      </Modal>
    </main>
  )
}
