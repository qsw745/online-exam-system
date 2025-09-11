// src/features/orgs/components/OrgDetailCard.tsx
import { Button, Card, Form, Input, InputNumber, Popconfirm, Space, Spin, Switch, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import type { OrgNode } from '@/shared/api/endpoints/orgs'

const { Title, Text } = Typography

// 把后端字段映射到表单字段（兼容 is_active / is_enabled）
function mapDetailToForm(detail: OrgNode | null | undefined) {
  if (!detail) return {}
  return {
    ...detail,
    // 有的后端返回 is_active: 0/1
    is_enabled:
      typeof (detail as any).is_enabled !== 'undefined'
        ? !!(detail as any).is_enabled
        : ((detail as any).is_active ?? 1) === 1,
  }
}

export default function OrgDetailCard({
  detail,
  loading,
  onSave,
  onDelete,
}: {
  detail: OrgNode | null
  loading: boolean
  onSave: (values: Partial<OrgNode>) => Promise<void> | void
  onDelete: () => Promise<void> | void
}) {
  const [form] = Form.useForm<OrgNode>()
  const [editing, setEditing] = useState(false)

  const formInitialValues = useMemo(() => mapDetailToForm(detail), [detail])

  // 💡 双保险：detail 变化时重置并灌值
  useEffect(() => {
    form.resetFields()
    form.setFieldsValue(formInitialValues as any)
  }, [formInitialValues, form])

  const startEdit = () => {
    if (!detail) return
    setEditing(true)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    await onSave({
      name: v.name?.trim(),
      code: v.code?.trim() || null,
      leader: v.leader?.trim() || null,
      phone: v.phone?.trim() || null,
      email: v.email?.trim() || null,
      address: v.address?.trim() || null,
      description: v.description?.trim() || null,
      // 仍以 is_enabled 作为前端字段；如果后端要 is_active，可以在调用 onSave 的地方再做一次转换
      is_enabled: !!v.is_enabled,
      sort_order: v.sort_order ?? 0,
    })
    setEditing(false)
  }

  const ro = !editing // 非编辑态可复制

  return (
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            组织信息
          </Title>
          {detail?.id ? <Text type="secondary">ID：{detail.id}</Text> : null}
        </Space>
      }
      extra={
        <Space>
          {!editing ? (
            <Button disabled={!detail} icon={<EditOutlined />} onClick={startEdit}>
              编辑
            </Button>
          ) : (
            <>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  form.setFieldsValue(formInitialValues as any)
                  setEditing(false)
                }}
              >
                取消
              </Button>
            </>
          )}
          <Popconfirm
            title="确定要删除该组织吗？"
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={onDelete}
            disabled={!detail}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!detail}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Form
        key={detail?.id ?? 'empty'} // ⭐ 切换组织时强制重挂载，确保展示即时更新
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={formInitialValues} // ⭐ 初始值直接来源于当前 detail
        style={{ maxWidth: 720 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : detail ? (
          <>
            <Form.Item
              label="组织名称"
              name="name"
              rules={[
                { required: true, message: '请输入组织名称' },
                { max: 64, message: '名称不超过64个字符' },
              ]}
            >
              <Input placeholder="例如：教务处 / 技术中心" readOnly={ro} />
            </Form.Item>

            <Form.Item label="组织编码" name="code" rules={[{ max: 64 }]}>
              <Input placeholder="可选" readOnly={ro} />
            </Form.Item>

            <Form.Item label="负责人" name="leader" rules={[{ max: 64 }]}>
              <Input readOnly={ro} />
            </Form.Item>

            <Form.Item label="联系电话" name="phone" rules={[{ max: 32 }]}>
              <Input readOnly={ro} />
            </Form.Item>

            <Form.Item label="电子邮箱" name="email" rules={[{ type: 'email' }, { max: 128 }]}>
              <Input readOnly={ro} />
            </Form.Item>

            <Form.Item label="地址" name="address" rules={[{ max: 128 }]}>
              <Input readOnly={ro} />
            </Form.Item>

            <Form.Item label="排序号" name="sort_order">
              <InputNumber min={0} step={1} style={{ width: '100%' }} readOnly={ro} />
            </Form.Item>

            <Form.Item label="描述" name="description" rules={[{ max: 500 }]}>
              <Input.TextArea rows={4} readOnly={ro} />
            </Form.Item>

            <Form.Item label="是否启用" name="is_enabled" valuePropName="checked">
              <Switch disabled={ro} />
            </Form.Item>
          </>
        ) : (
          <div style={{ padding: 24, color: '#999' }}>请选择左侧组织查看详情</div>
        )}
      </Form>
    </Card>
  )
}
