import { Button, Card, Form, Input, InputNumber, Popconfirm, Space, Spin, Switch, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { OrgNode } from '@shared/api/endpoints/orgs'

const { Title, Text } = Typography

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

  const startEdit = () => {
    if (!detail) return
    form.setFieldsValue({ ...detail, is_enabled: !!detail.is_enabled })
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
      is_enabled: !!v.is_enabled,
      sort_order: v.sort_order ?? 0,
    })
    setEditing(false)
  }

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
              <Button onClick={() => (form.resetFields(), setEditing(false))}>取消</Button>
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
        form={form}
        layout="vertical"
        disabled={!editing}
        preserve={false}
        initialValues={{ is_enabled: true }}
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
              <Input placeholder="例如：教务处 / 技术中心" />
            </Form.Item>

            <Form.Item label="组织编码" name="code" rules={[{ max: 64 }]}>
              <Input placeholder="可选" />
            </Form.Item>
            <Form.Item label="负责人" name="leader" rules={[{ max: 64 }]}>
              <Input />
            </Form.Item>
            <Form.Item label="联系电话" name="phone" rules={[{ max: 32 }]}>
              <Input />
            </Form.Item>
            <Form.Item label="电子邮箱" name="email" rules={[{ type: 'email' }, { max: 128 }]}>
              <Input />
            </Form.Item>
            <Form.Item label="地址" name="address" rules={[{ max: 128 }]}>
              <Input />
            </Form.Item>
            <Form.Item label="排序号" name="sort_order">
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="描述" name="description" rules={[{ max: 500 }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item label="是否启用" name="is_enabled" valuePropName="checked">
              <Switch disabled />
            </Form.Item>
          </>
        ) : (
          <div style={{ padding: 24, color: '#999' }}>请选择左侧组织查看详情</div>
        )}
      </Form>
    </Card>
  )
}
