import { InboxOutlined } from '@ant-design/icons'
import { App, Form, Input, Modal, Upload, type UploadProps } from 'antd'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type Props = {
  open: boolean
  parentId: number | null
  confirmLoading?: boolean
  onSubmit: (data: FormData) => Promise<void> | void
  onCancel: () => void
}

export function UploadFileModal({ open, parentId, confirmLoading, onSubmit, onCancel }: Props) {
  const { message } = App.useApp()
  const { t } = useLanguage()
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
      title={t('files.upload_file')}
      open={open}
      okText={t('files.upload')}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={async () => {
        if (!file) {
          message.error(t('files.validation.select_file'))
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
        <p className="ant-upload-text">{file ? file.name : t('files.upload_drag_text')}</p>
      </Upload.Dragger>
      <Form form={form} layout="vertical">
        <Form.Item label={t('files.fields.name')} name="name">
          <Input maxLength={120} placeholder={t('files.placeholders.file_name')} />
        </Form.Item>
        <Form.Item label={t('files.fields.tags')} name="tags">
          <Input placeholder={t('files.placeholders.tags')} />
        </Form.Item>
        <Form.Item label={t('files.fields.description')} name="description">
          <Input.TextArea rows={3} maxLength={200} showCount placeholder={t('files.placeholders.description')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default UploadFileModal
