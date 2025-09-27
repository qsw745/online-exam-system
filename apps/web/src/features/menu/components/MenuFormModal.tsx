import { Modal, Form, Input, Select, Switch } from 'antd'
import type { MenuDTO } from '@/shared/api/endpoints/menu'
import { useEffect, useState } from 'react'
import type { MenuFormData } from '../hooks/useMenus'

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
      title={editing ? '编辑菜单' : '新增菜单'}
      open={open}
      onOk={() => form.submit()}
      onCancel={onCancel}
      width={800}
      destroyOnHidden
      forceRender
    >
      <Form<MenuFormData> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="name" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
          <Input placeholder="请输入菜单名称" />
        </Form.Item>
        <Form.Item name="title" label="菜单标题" rules={[{ required: true, message: '请输入菜单标题' }]}>
          <Input placeholder="请输入菜单标题" />
        </Form.Item>
        <Form.Item name="path" label="路由路径">
          <Input placeholder="请输入路由路径" />
        </Form.Item>
        <Form.Item name="component" label="组件路径">
          <Input placeholder="请输入组件路径" />
        </Form.Item>
        <Form.Item name="icon" label="图标">
          <Input
            placeholder="如：user, setting, dashboard"
            addonBefore={iconPreview ? <span className={`anticon anticon-${iconPreview}`} /> : <span>图标</span>}
            onChange={e => setIconPreview(e.target.value)}
          />
        </Form.Item>
        <Form.Item name="parent_id" label="父级菜单">
          <Select placeholder="请选择父级菜单" allowClear options={parentOptions} />
        </Form.Item>
        <Form.Item name="menu_type" label="菜单类型" rules={[{ required: true, message: '请选择菜单类型' }]}>
          <Select
            options={[
              { value: 'menu', label: '菜单' },
              { value: 'button', label: '按钮' },
              { value: 'page', label: '页面' },
            ]}
          />
        </Form.Item>
        <Form.Item name="sort_order" label="排序号" tooltip="数值越小越靠前，留空则自动">
          <Input type="number" placeholder="留空自动排序" min={0} step={1} />
        </Form.Item>
        <Form.Item name="permission_code" label="权限编码">
          <Input placeholder="请输入权限编码" />
        </Form.Item>
        <Form.Item name="redirect" label="重定向路径">
          <Input placeholder="请输入重定向路径" />
        </Form.Item>
        <Form.Item name="meta" label="元数据(JSON)">
          <Input.TextArea rows={3} placeholder="请输入 JSON" />
        </Form.Item>
        <Form.Item name="is_hidden" valuePropName="checked">
          <Switch checkedChildren="隐藏" unCheckedChildren="显示" />
        </Form.Item>
        <Form.Item name="is_disabled" valuePropName="checked">
          <Switch checkedChildren="禁用" unCheckedChildren="启用" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
