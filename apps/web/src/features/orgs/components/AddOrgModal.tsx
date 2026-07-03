import { Form, Input, Modal } from 'antd'
import { translate } from '@/shared/utils/i18n'

export default function AddOrgModal({
  open,
  parentName,
  onOk,
  onCancel,
}: {
  open: boolean
  parentName?: string
  onOk: (payload: { name: string; code?: string }) => Promise<void> | void
  onCancel: () => void
}) {
  const [form] = Form.useForm<{ name: string; code?: string }>()

  const handleOk = async () => {
    const v = await form.validateFields()
    await onOk({ name: v.name.trim(), code: v.code?.trim() })
    form.resetFields()
  }

  return (
    <Modal
      maskClosable={false}
      title={parentName ? `新增子组织（上级：${parentName}）` : translate('visible.f7d963ecf7')}
      open={open}
      onOk={handleOk}
      onCancel={() => (form.resetFields(), onCancel())}
      okText={translate('orgs.form.submit.create')}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={translate('auto.6c2a3d4b46')}
          name="name"
          rules={[
            { required: true, message: translate('auto.ed20f086fc') },
            { max: 64, message: translate('orgs.form.name_max') },
          ]}
        >
          <Input placeholder={translate('auto.9cbfc0777e')} />
        </Form.Item>
        <Form.Item label={translate('auto.602babac93')} name="code" rules={[{ max: 64 }]}>
          <Input placeholder={translate('orgs.form.optional')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
