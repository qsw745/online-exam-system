import { Form, Input, Modal } from 'antd'
import { useEffect } from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type Props = {
  open: boolean
  title?: string
  confirmLoading?: boolean
  initialName?: string
  onSubmit: (values: { name: string }) => Promise<void> | void
  onCancel: () => void
}

export function CreateFolderModal({ open, title, confirmLoading, initialName, onSubmit, onCancel }: Props) {
  const { t } = useLanguage()
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
      title={title || t('files.new_folder')}
      open={open}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okText={t('app.save')}
      onOk={async () => {
        const values = await form.validateFields()
        await onSubmit(values)
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('files.fields.name')} name="name" rules={[{ required: true, message: t('files.validation.name_required') }]}>
          <Input maxLength={80} placeholder={t('files.placeholders.folder_name')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreateFolderModal
