import React from 'react'
import { Modal, Form, Input } from 'antd'

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
      title="回复讨论"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="回复"
      cancelText="取消"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="content" label="回复内容" rules={[{ required: true, message: '请输入回复内容' }]}>
          <TextArea rows={4} placeholder="请输入你的回复..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}
