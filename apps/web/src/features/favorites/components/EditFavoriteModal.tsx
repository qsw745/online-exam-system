import { Modal, Form, Input, Select, Spin } from 'antd'
import { useEffect } from 'react'
import type { Favorite } from '@/shared/api/endpoints/favorites'
import { useFavoriteCategories } from '@/features/favorites/hooks/useFavoriteCategories'

const { TextArea } = Input

type Props = {
  open: boolean
  initial: Favorite | null
  onCancel: () => void
  onSubmit: (payload: Partial<Favorite>) => void
}

function toBool(v: any): boolean {
  if (v === true) return true
  if (v === 1) return true
  if (v === '1') return true
  return false
}

export default function EditFavoriteModal({ open, initial, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm()
  // 只有弹窗打开时才请求；并且每次打开都 refetch 一次
  const { categories, loading, refetch } = useFavoriteCategories({ enabled: open })

  useEffect(() => {
    if (!open) return
    const normalized = initial
      ? {
          name: initial.name ?? '',
          description: (initial as any).description ?? '',
          category_id: initial.category_id ?? null,
          is_public: toBool((initial as any).is_public),
        }
      : { name: '', description: '', category_id: null, is_public: false }
    form.setFieldsValue(normalized)
    refetch()
  }, [open, initial, form, refetch])

  const handleFinish = (vals: any) => {
    const isPublic = !!vals.is_public
    const payload: Partial<Favorite> = {
      ...vals,
      // 如果后端支持 boolean，改成 is_public: isPublic
      is_public: (isPublic ? 1 : 0) as unknown as any,
      category_id: vals.category_id ?? null,
    }
    onSubmit(payload)
  }

  return (
    <Modal
      title="编辑收藏夹"
      open={open}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item name="name" label="收藏夹名称" rules={[{ required: true, message: '请输入收藏夹名称' }]}>
          <Input placeholder="请输入收藏夹名称" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="请输入收藏夹描述" />
        </Form.Item>

        <Form.Item name="category_id" label="分类">
          <Select
            placeholder={loading ? '加载分类中…' : categories.length ? '请选择分类（可不选）' : '暂无可用分类'}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={loading}
            options={categories.map(c => ({ label: c.name, value: c.id }))}
            notFoundContent={loading ? <Spin size="small" /> : '无数据'}
          />
        </Form.Item>

        <Form.Item name="is_public" label="是否公开">
          <Select
            options={[
              { label: '私有', value: false },
              { label: '公开', value: true },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
