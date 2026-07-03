import { Modal, Form, Input, Select, Switch } from 'antd'
import type { MenuDTO } from '@/shared/api/endpoints/menu'
import { useEffect, useState } from 'react'
import type { MenuFormData } from '../hooks/useMenus'
import { useLanguage } from '@/shared/contexts/LanguageContext'

export default function MenuFormModal({
  open,
  editing,
  parentOptions,
  onCancel,
  onSubmit,
}: {
  open: boolean
  editing: MenuDTO | null
  parentOptions: { label: string; value: number }[]
  onCancel: () => void
  onSubmit: (values: MenuFormData) => Promise<void> | void
}) {
  const { t } = useLanguage()
  const [form] = Form.useForm<MenuFormData>()
  const [iconPreview, setIconPreview] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      let meta = ''
      if (editing.meta) {
        try {
          meta = JSON.stringify(JSON.parse(editing.meta), null, 2)
        } catch {
          meta = editing.meta
        }
      }
      form.setFieldsValue({ ...editing, meta } as any)
      setIconPreview(editing.icon || '')
    } else {
      form.resetFields()
      form.setFieldsValue({ menu_type: 'menu', is_hidden: false, is_disabled: false } as any)
      setIconPreview('')
    }
  }, [open, editing, form])

  return (
    <Modal
      maskClosable={false}
      title={editing ? t('menuForm.edit_title') : t('menuForm.create_title')}
      open={open}
      onOk={() => form.submit()}
      onCancel={onCancel}
      width={800}
      destroyOnHidden
      forceRender
    >
      <Form<MenuFormData> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="name" label={t('menuForm.name')} rules={[{ required: true, message: t('menuForm.name_required') }]}>
          <Input placeholder={t('menuForm.name_placeholder')} />
        </Form.Item>
        <Form.Item name="title" label={t('menuForm.title')} rules={[{ required: true, message: t('menuForm.title_required') }]}>
          <Input placeholder={t('menuForm.title_placeholder')} />
        </Form.Item>
        <Form.Item name="path" label={t('menuForm.path')}>
          <Input placeholder={t('menuForm.path_placeholder')} />
        </Form.Item>
        <Form.Item name="component" label={t('menuForm.component')}>
          <Input placeholder={t('menuForm.component_placeholder')} />
        </Form.Item>
        <Form.Item name="icon" label={t('menuForm.icon')}>
          <Input
            placeholder={t('menuForm.icon_placeholder')}
            addonBefore={iconPreview ? <span className={`anticon anticon-${iconPreview}`} /> : <span>{t('menuForm.icon')}</span>}
            onChange={e => setIconPreview(e.target.value)}
          />
        </Form.Item>
        <Form.Item name="parent_id" label={t('menuForm.parent')}>
          <Select placeholder={t('menuForm.parent_placeholder')} allowClear options={parentOptions} />
        </Form.Item>
        <Form.Item name="menu_type" label={t('menuForm.type')} rules={[{ required: true, message: t('menuForm.type_required') }]}>
          <Select
            options={[
              { value: 'menu', label: t('menuForm.type_menu') },
              { value: 'button', label: t('menuForm.type_button') },
              { value: 'page', label: t('menuForm.type_page') },
            ]}
          />
        </Form.Item>
        <Form.Item name="sort_order" label={t('menuForm.sort_order')} tooltip={t('menuForm.sort_order_tooltip')}>
          <Input type="number" placeholder={t('menuForm.sort_order_placeholder')} min={0} step={1} />
        </Form.Item>
        <Form.Item name="permission_code" label={t('menuForm.permission_code')}>
          <Input placeholder={t('menuForm.permission_code_placeholder')} />
        </Form.Item>
        <Form.Item name="redirect" label={t('menuForm.redirect')}>
          <Input placeholder={t('menuForm.redirect_placeholder')} />
        </Form.Item>
        <Form.Item name="meta" label={t('menuForm.meta')}>
          <Input.TextArea rows={3} placeholder={t('menuForm.meta_placeholder')} />
        </Form.Item>
        <Form.Item name="is_hidden" valuePropName="checked">
          <Switch checkedChildren={t('menuForm.hidden')} unCheckedChildren={t('menuForm.visible')} />
        </Form.Item>
        <Form.Item name="is_disabled" valuePropName="checked">
          <Switch checkedChildren={t('menuForm.disabled')} unCheckedChildren={t('menuForm.enabled')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
