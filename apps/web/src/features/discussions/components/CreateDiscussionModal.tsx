import React from 'react'
import { Modal, Form, Input, Select } from 'antd'
import type { DiscussionCategory } from '@/shared/api/http'

const { TextArea } = Input
const { Option } = Select

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
      title="发起讨论"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="发布"
      cancelText="取消"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="title" label="讨论标题" rules={[{ required: true, message: '请输入讨论标题' }]}>
          <Input placeholder="请输入讨论标题" />
        </Form.Item>
        <Form.Item name="category_id" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
          <Select placeholder="请选择分类">
            {categories.map(c => (
              <Option key={c.id} value={c.id}>
                {c.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="question_id" label="关联题目（可选）">
          <Input placeholder="输入题目ID（可选）" type="number" />
        </Form.Item>
        <Form.Item name="content" label="讨论内容" rules={[{ required: true, message: '请输入讨论内容' }]}>
          <TextArea rows={6} placeholder="请详细描述你的问题或想法..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}
