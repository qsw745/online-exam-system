import { InboxOutlined } from '@ant-design/icons'
import { App, Form, Input, Modal, Upload, type UploadProps } from 'antd'
import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  parentId: number | null
  confirmLoading?: boolean
  onSubmit: (data: FormData) => Promise<void> | void
  onCancel: () => void
}

export function UploadFileModal({ open, parentId, confirmLoading, onSubmit, onCancel }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ name?: string; description?: string; tags?: string }>()
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setFile(null)
    }
  }, [open, form])

  const uploadProps: UploadProps = {
    accept: '*/*',
    maxCount: 1,
    beforeUpload: f => {
      setFile(f as File)
      form.setFieldsValue({ name: f.name })
      return false
    },
    onRemove: () => {
      setFile(null)
    },
  }

  return (
    <Modal
      title="上传文件"
      open={open}
      okText="上传"
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={async () => {
        if (!file) {
          message.error('请选择文件')
          return
        }
        const values = await form.validateFields()
        const formData = new FormData()
        formData.append('file', file)
        if (values.name) formData.append('name', values.name)
        if (values.description) formData.append('description', values.description)
        if (values.tags) formData.append('tags', values.tags)
        if (parentId != null) formData.append('parent_id', String(parentId))
        await onSubmit(formData)
        setFile(null)
        form.resetFields()
      }}
    >
      <Upload.Dragger {...uploadProps} style={{ marginBottom: 16 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{file ? file.name : '点击或拖拽文件到此处上传'}</p>
      </Upload.Dragger>
      <Form form={form} layout="vertical">
        <Form.Item label="名称" name="name">
          <Input maxLength={120} placeholder="可选，默认为文件原始名称" />
        </Form.Item>
        <Form.Item label="标签" name="tags">
          <Input placeholder="多个标签使用逗号分隔" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={3} maxLength={200} showCount placeholder="补充说明" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default UploadFileModal
