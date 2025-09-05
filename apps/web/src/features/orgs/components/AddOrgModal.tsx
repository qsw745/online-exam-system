import { Form, Input, Modal } from 'antd'

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
      title={parentName ? `新增子组织（上级：${parentName}）` : '新增根组织'}
      open={open}
      onOk={handleOk}
      onCancel={() => (form.resetFields(), onCancel())}
      okText="创建"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="组织名称"
          name="name"
          rules={[
            { required: true, message: '请输入组织名称' },
            { max: 64, message: '名称不超过64个字符' },
          ]}
        >
          <Input placeholder="例如：市场部 / 教学部" />
        </Form.Item>
        <Form.Item label="组织编码" name="code" rules={[{ max: 64 }]}>
          <Input placeholder="可选" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
