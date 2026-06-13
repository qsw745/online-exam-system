// src/features/roles/components/RoleFormModal.tsx
import { Form, Input, Modal } from 'antd'
import React from 'react'

export default function RoleFormModal({
  open,
  role,
  onCancel,
  onOk,
}: {
  open: boolean
  role: { id?: number; name?: string; code?: string; description?: string } | null
  onCancel: () => void
  onOk: (payload: { name: string; code?: string; description?: string }) => Promise<void> | void
}) {
  const [form] = Form.useForm()
  const isEdit = !!role?.id

  // 在 Modal 完全打开时再灌值
  const afterOpenChange = (opened: boolean) => {
    if (opened) {
      form.setFieldsValue({
        name: role?.name ?? '',
        code: role?.code ?? '',
        description: role?.description ?? '',
      })
    } else {
      form.resetFields()
    }
  }

  const handleOk = async () => {
    const v = await form.validateFields()
    await onOk({
      name: v.name,
      code: v.code || undefined,
      description: v.description || undefined,
    })
  }

  return (
    <Modal
      maskClosable={false}
      title={isEdit ? '编辑角色' : '新建角色'}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
      destroyOnHidden
      forceRender
      afterOpenChange={afterOpenChange}
    >
      <Form key={role?.id ?? 'new'} form={form} layout="vertical" preserve={false}>
        <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
          <Input placeholder="例如：教务管理员" autoFocus />
        </Form.Item>
        <Form.Item label="角色编码" name="code" tooltip="可选；建议使用英文/下划线组合">
          <Input placeholder="例如：academic_admin" />
        </Form.Item>
        <Form.Item label="备注" name="description">
          <Input.TextArea rows={3} maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
