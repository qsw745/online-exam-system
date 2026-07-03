import { Modal, Form, Input, Select, Spin } from 'antd'
import { useEffect } from 'react'
import type { Favorite } from '@/shared/api/endpoints/favorites'
import { useFavoriteCategories } from '@/features/favorites/hooks/useFavoriteCategories'
import { translate } from '@/shared/utils/i18n'

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
      title={translate('auto.a731f846bc')}
      open={open}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={() => form.submit()}
      okText={translate('app.save')}
      cancelText={translate('app.cancel')}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item name="name" label={translate('auto.638376b72c')} rules={[{ required: true, message: translate('auto.935ce4af18') }]}>
          <Input placeholder={translate('auto.935ce4af18')} />
        </Form.Item>

        <Form.Item name="description" label={translate('papers.desc2')}>
          <TextArea rows={3} placeholder={translate('auto.5d0589458d')} />
        </Form.Item>

        <Form.Item name="category_id" label={translate('auto.435c5259e4')}>
          <Select
            placeholder={loading ? translate('visible.1530bce68f') : categories.length ? translate('visible.d435be9394') : translate('visible.16e1299b06')}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={loading}
            options={categories.map(c => ({ label: c.name, value: c.id }))}
            notFoundContent={loading ? <Spin size="small" /> : translate('visible.6ffa7e6d35')}
          />
        </Form.Item>

        <Form.Item name="is_public" label={translate('auto.5857cbafde')}>
          <Select
            options={[
              { label: translate('auto.6858674b88'), value: false },
              { label: translate('settings.public'), value: true },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
