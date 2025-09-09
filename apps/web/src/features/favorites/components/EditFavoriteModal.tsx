// src/features/favorites/components/EditFavoriteModal.tsx
import { Modal, Form, Input, Select } from 'antd'
import type { Favorite, FavoriteCategory } from '@/shared/api/endpoints/favorites'
const { TextArea } = Input
const { Option } = Select

type Props = {
  open: boolean
  categories: FavoriteCategory[]
  initial: Favorite | null
  onCancel: () => void
  onSubmit: (payload: Partial<Favorite>) => void
}
export default function EditFavoriteModal({ open, categories, initial, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm()
  return (
    <Modal
      title="编辑收藏夹"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={initial ? { ...initial, category_id: initial.category_id } : {}}
      >
        <Form.Item name="name" label="收藏夹名称" rules={[{ required: true, message: '请输入收藏夹名称' }]}>
          <Input placeholder="请输入收藏夹名称" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="请输入收藏夹描述" />
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
        <Form.Item name="is_public" label="是否公开">
          <Select>
            <Option value={false}>私有</Option>
            <Option value={true}>公开</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}
