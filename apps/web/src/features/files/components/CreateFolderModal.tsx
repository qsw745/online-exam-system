import { Form, Input, Modal } from 'antd'
import { useEffect } from 'react'

type Props = {
  open: boolean
  title?: string
  confirmLoading?: boolean
  initialName?: string
  onSubmit: (values: { name: string }) => Promise<void> | void
  onCancel: () => void
}

export function CreateFolderModal({ open, title, confirmLoading, initialName, onSubmit, onCancel }: Props) {
  const [form] = Form.useForm<{ name: string }>()

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ name: initialName || '' })
    } else {
      form.resetFields()
    }
  }, [open, initialName, form])

  return (
    <Modal
      title={title || '新建文件夹'}
      open={open}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okText="保存"
      onOk={async () => {
        const values = await form.validateFields()
        await onSubmit(values)
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input maxLength={80} placeholder="输入文件夹名称" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateFolderModal
