import { Alert, Button, Card, Form, Input, List, Radio, Skeleton, Space, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

import {
  createClientDeletionStatusToken,
  deletionStatusCredentialStore,
  type DeletionStatusCredentialStore,
} from '@/platform/account-deletion/deletionStatusCredential'
import { clearTokenAll } from '@/shared/api/core/storage'
import type { ApiResult } from '@/shared/api/core/types'
import {
  accountDeletionApi,
  type AccountDeletionRequestPayload,
  type DeletionMode,
  type DeletionPreview,
  type DeletionStatus,
} from '@/shared/api/endpoints/accountDeletion'
import { translate } from '@/shared/utils/i18n'

const { Paragraph, Text, Title } = Typography

type RequestApi = {
  preview(): Promise<ApiResult<DeletionPreview>>
  request(payload: AccountDeletionRequestPayload): Promise<ApiResult<DeletionStatus>>
}

type PendingRequest = {
  requestId: string
  statusToken: string
  mode: DeletionMode
}

const createRequestId = (): string => {
  if (!globalThis.crypto?.randomUUID) throw new Error('当前环境不支持安全请求编号')
  return globalThis.crypto.randomUUID()
}

export default function AccountDeletionRequestCard({
  api = accountDeletionApi,
  credentialStore = deletionStatusCredentialStore,
  clearLoginSession = clearTokenAll,
  onAccepted,
  createRequestId: requestIdFactory = createRequestId,
  createStatusToken = createClientDeletionStatusToken,
}: {
  api?: RequestApi
  credentialStore?: DeletionStatusCredentialStore
  clearLoginSession?: () => Promise<void>
  onAccepted?: (status: Exclude<DeletionStatus, { status: 'NOT_REQUESTED' }>) => void | Promise<void>
  createRequestId?: () => string
  createStatusToken?: () => string
}) {
  const [form] = Form.useForm<{ mode: DeletionMode; password: string; confirmationPhrase: string }>()
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'warning' | 'success'; message: string } | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const pendingRequest = useRef<PendingRequest | null>(null)
  const mode = Form.useWatch('mode', form) ?? 'IMMEDIATE'

  useEffect(() => {
    let active = true
    void api.preview().then(result => {
      if (!active) return
      if (result.success) setPreview(result.data)
      else setFeedback({ type: 'error', message: result.error || translate('account.deletion.preview_failed') })
      setLoadingPreview(false)
    })
    return () => { active = false }
  }, [api])

  const submit = async (values: { mode: DeletionMode; password: string; confirmationPhrase: string }) => {
    if (!preview) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const pending = pendingRequest.current ?? {
        requestId: requestIdFactory(),
        statusToken: createStatusToken(),
        mode: values.mode,
      }
      pendingRequest.current = pending
      await credentialStore.write({ requestId: pending.requestId, statusToken: pending.statusToken })

      const result = await api.request({
        requestId: pending.requestId,
        mode: pending.mode,
        statusToken: pending.statusToken,
        password: values.password,
        confirmationPhrase: values.confirmationPhrase,
      })
      if (!result.success) {
        const definiteClientRejection = result.status != null && result.status >= 400 && result.status < 500
        if (definiteClientRejection) {
          await credentialStore.clear()
          pendingRequest.current = null
          setUncertain(false)
          setFeedback({ type: 'error', message: result.error })
        } else {
          setUncertain(true)
          setFeedback({
            type: 'warning',
            message: translate('account.deletion.uncertain'),
          })
        }
        return
      }
      if (result.data.status === 'NOT_REQUESTED') {
        throw new Error(translate('account.deletion.invalid_status'))
      }
      setUncertain(false)
      pendingRequest.current = null
      setFeedback({ type: 'success', message: translate('account.deletion.accepted') })
      try {
        await clearLoginSession()
      } catch {
        setFeedback({ type: 'warning', message: translate('account.deletion.accepted_cleanup_warning') })
      }
      try {
        await onAccepted?.(result.data)
      } catch {
        setFeedback({ type: 'warning', message: translate('account.deletion.accepted_status_hint') })
      }
    } catch (error) {
      setUncertain(Boolean(pendingRequest.current))
      setFeedback({
        type: 'warning',
        message: error instanceof Error ? error.message : translate('account.deletion.unknown_error'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card
      styles={{ body: { padding: 'clamp(18px, 4vw, 28px)' } }}
      style={{ marginTop: 20, borderColor: 'rgba(220, 38, 38, .28)', borderRadius: 18 }}
    >
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div>
          <Text type="danger" strong>{translate('account.deletion.danger_zone')}</Text>
          <Title level={4} style={{ margin: '4px 0 6px' }}>{translate('account.deletion.title')}</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {translate('account.deletion.summary')}
          </Paragraph>
        </div>

        {loadingPreview ? <Skeleton active paragraph={{ rows: 3 }} /> : preview ? (
          <>
            <Alert type="warning" showIcon message={preview.disclaimer} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Card size="small" title={translate('account.deletion.delete_data')}>
                <List size="small" dataSource={preview.deleteOrAnonymize} renderItem={item => <List.Item>{item}</List.Item>} />
              </Card>
              <Card size="small" title={translate('account.deletion.retain_data')}>
                <List size="small" dataSource={preview.conditionalRetention} renderItem={item => <List.Item>{item}</List.Item>} />
              </Card>
            </div>

            <Form
              form={form}
              layout="vertical"
              initialValues={{ mode: 'IMMEDIATE', password: '', confirmationPhrase: '' }}
              onFinish={submit}
            >
              <Form.Item name="mode" label={translate('account.deletion.mode')} rules={[{ required: true }]}>
                <Radio.Group disabled={uncertain} style={{ display: 'grid', gap: 8 }}>
                  <Radio value="IMMEDIATE">{translate('account.deletion.immediate')}</Radio>
                  <Radio value="GRACE_PERIOD">{translate('account.deletion.grace')}</Radio>
                </Radio.Group>
              </Form.Item>
              <Alert
                style={{ marginBottom: 16 }}
                type={mode === 'IMMEDIATE' ? 'error' : 'info'}
                showIcon
                message={mode === 'IMMEDIATE'
                  ? translate('account.deletion.immediate_warning')
                  : translate('account.deletion.grace_warning').replace('{days}', String(preview.graceDays))}
              />
              <Form.Item name="password" label={translate('account.current_password')} rules={[{ required: true, message: translate('account.current_password_required') }]}>
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Form.Item
                name="confirmationPhrase"
                label={translate('account.deletion.confirmation')}
                extra={<>{translate('account.deletion.enter_phrase')}<Text code>{preview.confirmationPhrase}</Text></>}
                rules={[
                  { required: true, message: translate('account.deletion.confirmation_required') },
                  {
                    validator: (_, value) => value === preview.confirmationPhrase
                      ? Promise.resolve()
                      : Promise.reject(new Error(translate('account.deletion.confirmation_mismatch'))),
                  },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
              {feedback ? <Alert style={{ marginBottom: 16 }} type={feedback.type} showIcon message={feedback.message} /> : null}
              <Button danger type="primary" htmlType="submit" loading={submitting} block>
                {uncertain ? translate('account.deletion.retry') : translate('account.deletion.submit')}
              </Button>
            </Form>
          </>
        ) : null}
      </Space>
    </Card>
  )
}
