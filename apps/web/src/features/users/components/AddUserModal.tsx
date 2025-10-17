import React from 'react'
import { App, Button, Form, Input, Modal, Row, Col, Space, Switch, TreeSelect, Typography, Select } from 'antd'
import { useOrgTree } from '@/shared/hooks'

const { Text } = Typography

type Gender = '男' | '女' | '保密'

type FormValues = {
  nickname: string
  username: string
  password: string
  phone?: string
  email?: string
  gender?: Gender
  org_id?: number
  enabled?: boolean
  remark?: string
}

export type SubmitPayload = {
  username: string
  nickname: string
  password: string
  phone?: string
  email?: string
  gender?: Gender
  org_id?: number
  status: 'active' | 'disabled'
  remark?: string
}

function treeToTreeSelectData(tree: any[]): any[] {
  if (!Array.isArray(tree)) return []
  return tree.map((n: any) => ({
    title: n?.title ?? n?.name ?? n?.label ?? `机构 #${n?.id}`,
    value: n?.id,
    key: n?.id,
    children: treeToTreeSelectData(n?.children || n?.nodes || []),
  }))
}

export const AddUserModal: React.FC<{
  open: boolean
  defaultOrgId?: number | null
  onCancel: () => void
  onSubmit: (payload: SubmitPayload) => Promise<void> | void
}> = ({ open, defaultOrgId, onCancel, onSubmit }) => {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const { tree, loading: treeLoading, refetch } = useOrgTree()

  React.useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      enabled: true,
      gender: undefined,
      org_id: defaultOrgId ?? undefined,
    })
    void refetch()
  }, [open, defaultOrgId, form, refetch])

  const [submitting, setSubmitting] = React.useState(false)

  const handleOk = async () => {
    try {
      const v = await form.validateFields()
      const payload: SubmitPayload = {
        username: v.username.trim(),
        nickname: v.nickname.trim(),
        password: v.password,
        phone: v.phone?.trim() || undefined,
        email: v.email?.trim() || undefined,
        gender: v.gender || undefined,
        org_id: v.org_id || undefined,
        status: v.enabled ? 'active' : 'disabled',
        remark: v.remark?.trim() || undefined,
      }
      setSubmitting(true)
      await onSubmit(payload)
      message.success('新增用户成功')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  const treeData = React.useMemo(() => treeToTreeSelectData(tree as any), [tree])

  return (
    <Modal
      open={open}
      title={
        <Space>
          <Text strong>新增用户</Text>
        </Space>
      }
      onCancel={onCancel}
      onOk={handleOk}
      okText="确定"
      cancelText="取消"
      okButtonProps={{ loading: submitting }}
      maskClosable={false}
      width={1000}
      styles={{ body: { paddingTop: 12 } }}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="horizontal"
        labelCol={{ flex: '92px' }}
        wrapperCol={{ flex: 'auto' }}
        colon={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="用户昵称" name="nickname" rules={[{ required: true, message: '请输入用户昵称' }]}>
              <Input placeholder="请输入用户昵称" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="用户名称"
              name="username"
              rules={[
                { required: true, message: '请输入用户名称' },
                { min: 3, message: '长度至少 3 个字符' },
              ]}
            >
              <Input placeholder="请输入用户名称" allowClear />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="用户密码"
              name="password"
              rules={[
                { required: true, message: '请输入用户密码' },
                { min: 6, message: '长度至少 6 位' },
              ]}
            >
              <Input.Password placeholder="请输入用户密码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="手机号" name="phone" rules={[{ pattern: /^1\d{10}$/, message: '请输入正确的手机号' }]}>
              <Input placeholder="请输入手机号" allowClear />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入正确的邮箱' }]}>
              <Input placeholder="请输入邮箱" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="用户性别" name="gender">
              <Select
                placeholder="请选择用户性别"
                allowClear
                options={[
                  { label: '男', value: '男' },
                  { label: '女', value: '女' },
                  { label: '保密', value: '保密' },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="归属部门" name="org_id">
              <TreeSelect
                loading={treeLoading}
                treeData={treeData}
                allowClear
                placeholder="请选择归属部门"
                showSearch
                treeDefaultExpandAll
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="用户状态" name="enabled" valuePropName="checked">
              <Space>
                <Switch />
                <Text type="success">启用</Text>
              </Space>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item label="备注" name="remark">
              <Input.TextArea rows={3} placeholder="请输入备注信息" allowClear />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

export default AddUserModal
