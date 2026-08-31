import { Alert, Button, Form, Input, Modal, Select, Space } from 'antd'
import { useEffect, useState } from 'react'

import type { LifecycleCategoryCode, RetentionHoldPayload } from '@/shared/api/endpoints/privacyLifecycle'
import { translate } from '@/shared/utils/i18n'
import { HOLDABLE_CATEGORY_CODES } from '../domain/lifecyclePresentation'

const REASON_CODES: RetentionHoldPayload['reasonCode'][] = [
  'LEGAL_DISPUTE',
  'REGULATORY_REQUEST',
  'SECURITY_INCIDENT',
  'CONTRACTUAL_ARCHIVE',
]

export default function RetentionHoldModal({
  open,
  holdId,
  scopeId,
  uncertain,
  feedback,
  onCancel,
  onSubmit,
}: {
  open: boolean
  holdId: string
  scopeId: string
  uncertain?: boolean
  feedback?: string | null
  onCancel: () => void
  onSubmit: (payload: RetentionHoldPayload) => Promise<boolean>
}) {
  const [form] = Form.useForm<RetentionHoldPayload>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      holdId,
      scopeId,
      scopeType: 'USER_REQUEST',
    })
  }, [form, holdId, open, scopeId])

  const submit = async (values: RetentionHoldPayload) => {
    setSubmitting(true)
    try {
      const expiresAt = new Date(values.expiresAt)
      const succeeded = await onSubmit({ ...values, holdId, scopeId, expiresAt: expiresAt.toISOString() })
      if (succeeded) form.resetFields()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={translate('privacyLifecycle.hold.title', '创建合法冻结')}
      footer={null}
      maskClosable={false}
      closable={!uncertain && !submitting}
      keyboard={!uncertain && !submitting}
      destroyOnHidden
      onCancel={() => {
        if (submitting || uncertain) return
        form.resetFields()
        onCancel()
      }}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message={translate('privacyLifecycle.hold.warning', '冻结仅适用于有明确法律依据的数据类别，不能冻结认证凭据或原始人脸凭据。')}
        />
        {feedback ? <Alert type="warning" showIcon message={feedback} /> : null}
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="holdId" label={translate('privacyLifecycle.hold.id', '冻结编号')} rules={[{ required: true }]}>
            <Input readOnly disabled={uncertain} />
          </Form.Item>
          <Form.Item name="categoryCode" label={translate('privacyLifecycle.hold.category', '数据类别')} rules={[{ required: true, message: translate('privacyLifecycle.hold.categoryRequired', '请选择数据类别') }]}>
            <Select
              disabled={uncertain}
              options={HOLDABLE_CATEGORY_CODES.map(code => ({
                value: code as LifecycleCategoryCode,
                label: translate(`privacyLifecycle.category.${code}`),
              }))}
            />
          </Form.Item>
          <Form.Item name="scopeType" label={translate('privacyLifecycle.hold.scopeType', '冻结范围')} rules={[{ required: true }]}>
            <Select disabled options={[
              { value: 'USER_REQUEST', label: translate('privacyLifecycle.hold.scopeUserRequest', '账号注销申请') },
            ]} />
          </Form.Item>
          <Form.Item name="scopeId" label={translate('privacyLifecycle.hold.scopeId', '范围编号')} rules={[{ required: true, message: translate('privacyLifecycle.hold.scopeIdRequired', '请输入范围编号') }]}>
            <Input readOnly disabled={uncertain} />
          </Form.Item>
          <Form.Item name="reasonCode" label={translate('privacyLifecycle.hold.reason', '冻结原因')} rules={[{ required: true, message: translate('privacyLifecycle.hold.reasonRequired', '请选择冻结原因') }]}>
            <Select disabled={uncertain} options={REASON_CODES.map(code => ({ value: code, label: translate(`privacyLifecycle.hold.reason.${code}`) }))} />
          </Form.Item>
          <Form.Item name="legalBasisReference" label={translate('privacyLifecycle.hold.basis', '法律依据或案件编号')} rules={[{ required: true, message: translate('privacyLifecycle.hold.basisRequired', '请输入法律依据') }, { max: 500 }]}>
            <Input.TextArea rows={3} maxLength={500} showCount disabled={uncertain} />
          </Form.Item>
          <Form.Item name="expiresAt" label={translate('privacyLifecycle.hold.expiresAt', '冻结到期时间')} rules={[{ required: true, message: translate('privacyLifecycle.hold.expiresAtRequired', '请选择冻结到期时间') }]}>
            <Input type="datetime-local" disabled={uncertain} />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={submitting}>
            {uncertain ? translate('privacyLifecycle.operation.retry') : translate('privacyLifecycle.hold.submit', '确认创建冻结')}
          </Button>
        </Form>
      </Space>
    </Modal>
  )
}
