import { Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import type { StaffReviewAction } from '../domain/reviewPresentation'
import { translate } from '@/shared/utils/i18n'

const REASONS: Record<StaffReviewAction, string[]> = {
  request_information: ['CANDIDATE_EXPLANATION_REQUIRED'],
  clear: ['SENSOR_INTERRUPTION_EXPLAINED', 'IDENTITY_CONFIRMED_MANUALLY', 'INSUFFICIENT_EVIDENCE'],
  confirm_violation: [
    'MULTIPLE_PERSONS_CONFIRMED',
    'SCREEN_CAPTURE_CONFIRMED',
    'IDENTITY_MISMATCH_CONFIRMED',
    'UNRESOLVED_SENSOR_INTERRUPTION',
  ],
  resolve_appeal_upheld: ['APPEAL_EVIDENCE_ACCEPTED'],
  resolve_appeal_rejected: ['APPEAL_EVIDENCE_REJECTED'],
}

const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-0000-4000-8000-${Math.random()}`

export function ProctoringReviewDecisionModal(props: {
  open: boolean
  action: StaffReviewAction | null
  expectedVersion: number
  loading?: boolean
  onCancel: () => void
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (props.open && props.action) {
      form.resetFields()
      form.setFieldValue('reasonCode', REASONS[props.action][0])
    }
  }, [form, props.action, props.open])

  const submit = async () => {
    if (!props.action) return
    const values = await form.validateFields()
    await props.onSubmit({
      decisionId: uuid(),
      action: props.action,
      reasonCode: values.reasonCode,
      comment: values.comment,
      expectedVersion: props.expectedVersion,
      ...(props.action === 'request_information'
        ? { messageId: uuid(), informationRequest: values.informationRequest }
        : {}),
    })
  }

  return (
    <Modal
      open={props.open}
      title={props.action ? translate(`proctoringReview.action.${props.action}`) : ''}
      okText={translate('app.confirm')}
      cancelText={translate('app.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onCancel}
      onOk={() => void submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="reasonCode" label={translate('proctoringReview.field.reason')} rules={[{ required: true }]}>
          <Select
            options={(props.action ? REASONS[props.action] : []).map(value => ({
              value,
              label: translate(`proctoringReview.reason.${value}`),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="comment"
          label={translate('proctoringReview.field.comment')}
          rules={[{ required: true }, { max: 1000 }]}
        >
          <Input.TextArea rows={4} maxLength={1000} showCount />
        </Form.Item>
        {props.action === 'request_information' && (
          <Form.Item
            name="informationRequest"
            label={translate('proctoringReview.field.informationRequest')}
            rules={[{ required: true }, { max: 1000 }]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default ProctoringReviewDecisionModal
