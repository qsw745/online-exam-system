import React from 'react'
import { Modal, Form, Input } from 'antd'
import { translate } from '@/shared/utils/i18n'

const { TextArea } = Input

type FormValues = { content: string }

type Props = {
  open: boolean
  onClose: () => void
  form: any
  onSubmit: (values: FormValues) => void
}

export const ReplyModal: React.FC<Props> = ({ open, onClose, form, onSubmit }) => {
  return (
    <Modal
      maskClosable={false}
      title={translate('auto.3e5d854d61')}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={translate('auto.ffc7850925')}
      cancelText={translate('app.cancel')}
      // ↓↓↓ 修复：用 destroyOnHidden 取代 destroyOnClose
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="content" label={translate('auto.a36c787d35')} rules={[{ required: true, message: translate('auto.9eb4b675e6') }]}>
          <TextArea rows={5} placeholder={translate('auto.5f76f4a3f3')} maxLength={2000} showCount allowClear />
        </Form.Item>
      </Form>
    </Modal>
  )
}
