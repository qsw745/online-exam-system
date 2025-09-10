// src/features/users/components/BindUserModal.tsx
import { Form, Input, Modal } from 'antd'
import React from 'react'

export const BindUserModal: React.FC<{
  open: boolean
  onCancel: () => void
  onSubmit: (userId: number) => Promise<void> | void
}> = ({ open, onCancel, onSubmit }) => {
  const [form] = Form.useForm()

  React.useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const handleOk = async () => {
    const { userId } = await form.validateFields()
    await onSubmit(Number(userId))
  }

  return (
    <Modal title="新增用户到该机构" open={open} onCancel={onCancel} onOk={handleOk} okText="绑定" destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="用户ID"
          name="userId"
          rules={[{ required: true, message: '请输入用户ID' }]}
          extra="如需改为邮箱绑定，可把接口换成 /orgs/:id/users/by-email"
        >
          <Input placeholder="例如：1001" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
