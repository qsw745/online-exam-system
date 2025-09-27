import React from 'react'
import { Modal, Form, Input, Select } from 'antd'

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
          <Input placeholder="请输入讨论标题" maxLength={80} showCount />
        </Form.Item>

        {/* 关键修复：使用 options，避免 Option children 为空时只显示 id */}
        <Form.Item name="category_id" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
          <Select
            placeholder="请选择分类"
            options={categories.map(c => ({
              value: c.id,
              label: c.name || `分类 #${c.id}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="question_id" label="关联题目（可选）">
          <Input placeholder="输入题目ID（可选）" type="number" />
        </Form.Item>

        <Form.Item name="content" label="讨论内容" rules={[{ required: true, message: '请输入讨论内容' }]}>
          <TextArea rows={6} placeholder="请详细描述你的观点或问题…" maxLength={2000} showCount allowClear />
        </Form.Item>
      </Form>
    </Modal>
  )
}
