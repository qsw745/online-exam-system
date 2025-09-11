// src/features/favorites/components/CreateFavoriteModal.tsx
import { useEffect } from 'react'
import { Modal, Form, Input, Select, Empty } from 'antd'
import type { FavoriteCategory } from '@/shared/api/endpoints/favorites'
const { TextArea } = Input
const { Option } = Select

type Props = {
  open: boolean
  categories: FavoriteCategory[]
  onCancel: () => void
  onSubmit: (payload: { name: string; description?: string; category_id: number | null; is_public: boolean }) => void
}

export default function CreateFavoriteModal({ open, categories, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm()

  // 打开时：有分类选第一个；无分类设为 null
  useEffect(() => {
    if (!open) return
    if (categories.length > 0) {
      form.setFieldsValue({ category_id: categories[0].id })
    } else {
      form.setFieldsValue({ category_id: null })
    }
  }, [open, categories, form])

  return (
    <Modal
      title="创建收藏夹"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="创建"
      cancelText="取消"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ is_public: false }}
        onFinish={vals => onSubmit({ ...vals, category_id: vals.category_id ?? null })}
      >
        <Form.Item name="name" label="收藏夹名称" rules={[{ required: true, message: '请输入收藏夹名称' }]}>
          <Input placeholder="请输入收藏夹名称" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="请输入收藏夹描述" />
        </Form.Item>

        <Form.Item
          name="category_id"
          label="分类"
          rules={categories.length > 0 ? [{ required: true, message: '请选择分类' }] : []}
        >
          {categories.length > 0 ? (
            <Select placeholder="请选择分类" allowClear>
              {categories.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.name}
                </Option>
              ))}
            </Select>
          ) : (
            <Empty description="暂无可选分类（将创建为未分类）" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Form.Item>

        <Form.Item name="is_public" label="是否公开" initialValue={false}>
          <Select>
            <Option value={false}>私有</Option>
            <Option value={true}>公开</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}
