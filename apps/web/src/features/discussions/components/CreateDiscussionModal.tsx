import React from 'react'
import { Modal, Form, Input, Select } from 'antd'
import { translate } from '@/shared/utils/i18n'

const { TextArea } = Input

type DiscussionCategory = { id: number; name?: string }

type FormValues = {
  title: string
  category_id: number
  question_id?: number
  content: string
}

type Props = {
  open: boolean
  onClose: () => void
  categories: DiscussionCategory[]
  form: any
  onSubmit: (values: FormValues) => void
}

export const CreateDiscussionModal: React.FC<Props> = ({ open, onClose, categories, form, onSubmit }) => {
  return (
    <Modal
      maskClosable={false}
      title={translate('auto.85f5cb8f6e')}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={translate('auto.94f172d02f')}
      cancelText={translate('app.cancel')}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="title" label={translate('auto.5abf5f3270')} rules={[{ required: true, message: translate('auto.3f22ae05c6') }]}>
          <Input placeholder={translate('auto.3f22ae05c6')} maxLength={80} showCount />
        </Form.Item>

        {/* 关键修复：使用 options，避免 Option children 为空时只显示 id */}
        <Form.Item name="category_id" label={translate('auto.435c5259e4')} rules={[{ required: true, message: translate('auto.8403762083') }]}>
          <Select
            placeholder={translate('auto.8403762083')}
            options={categories.map(c => ({
              value: c.id,
              label: c.name || `分类 #${c.id}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="question_id" label={translate('auto.76d3879635')}>
          <Input placeholder={translate('auto.b4f58c40d7')} type="number" />
        </Form.Item>

        <Form.Item name="content" label={translate('auto.c1e87b4fc3')} rules={[{ required: true, message: translate('auto.c4bca415e7') }]}>
          <TextArea rows={6} placeholder={translate('auto.624834dff9')} maxLength={2000} showCount allowClear />
        </Form.Item>
      </Form>
    </Modal>
  )
}
