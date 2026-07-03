// src/features/roles/components/RoleFormModal.tsx
import { Form, Input, Modal } from 'antd'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

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
      title={isEdit ? translate('visible.b9dcd82a7b') : translate('roles.action.create')}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={translate('app.save')}
      destroyOnHidden
      forceRender
      afterOpenChange={afterOpenChange}
    >
      <Form key={role?.id ?? 'new'} form={form} layout="vertical" preserve={false}>
        <Form.Item label={translate('roles.columns.name')} name="name" rules={[{ required: true, message: translate('roles.filters.name_placeholder') }]}>
          <Input placeholder={translate('auto.4eb7ae2c2c')} autoFocus />
        </Form.Item>
        <Form.Item label={translate('auto.c12ace673d')} name="code" tooltip={translate('auto.8349222c6c')}>
          <Input placeholder={translate('auto.ff67c4c3e2')} />
        </Form.Item>
        <Form.Item label={translate('users.form.remark')} name="description">
          <Input.TextArea rows={3} maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
