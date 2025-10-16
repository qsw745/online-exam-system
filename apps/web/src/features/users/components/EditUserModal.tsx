// apps/web/src/features/users/components/EditUserModal.tsx
import React, { useMemo } from 'react'
import { Form, Input, Modal, Select, TreeSelect } from 'antd'
const { Option } = Select

// 转 TreeSelect 数据（只取有 id 的）
function toTreeOptions(tree: any[] = []): any[] {
  const dfs = (n: any): any | null => {
    if (!n || n.id == null) return null
    const children = Array.isArray(n.children) ? n.children.map(dfs).filter(Boolean) : undefined
    return { value: Number(n.id), label: n.name, children }
  }
  return (tree || []).map(dfs).filter(Boolean) as any[]
}

export const EditUserModal: React.FC<{
  open: boolean
  user: any | null
  tree: any[]
  onCancel: () => void
  onSubmit: (payload: {
    username: string
    nickname?: string
    phone?: string
    email?: string
    gender?: 'male' | 'female'
    orgId?: number | null
    remark?: string
    description?: string
  }) => Promise<void> | void
}> = ({ open, user, tree, onCancel, onSubmit }) => {
  const [form] = Form.useForm()

  // —— 回显映射 —— //
  const mapped = useMemo(() => {
    if (!user) return undefined
    const originalOrgId =
      typeof user.orgId === 'number' ? user.orgId : typeof user.org_id === 'number' ? user.org_id : undefined
    const g = (user.gender || '').toString()
    const gender = g === 'male' || g === '男' ? '男' : g === 'female' || g === '女' ? '女' : undefined
    return {
      nickname: user.nickname ?? user.real_name ?? '',
      username: user.username ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      gender,
      orgId: originalOrgId,
      remark: user.remark ?? user.description ?? '',
      __originalOrgId: originalOrgId,
    }
  }, [user])

  const handleOk = async () => {
    const v = await form.validateFields()
    // 原始 orgId
    const originalOrgId: number | undefined = form.getFieldValue('__originalOrgId')
    // 当前选择 orgId：不改则保持原值
    let nextOrgId: number | null | undefined =
      typeof v.orgId === 'number' ? v.orgId : v.orgId == null ? undefined : Number(v.orgId)
    if (typeof nextOrgId === 'undefined') nextOrgId = typeof originalOrgId === 'number' ? originalOrgId : undefined

    const payload: any = {
      username: String(v.username || '').trim(),
      nickname: (v.nickname || '').trim(),
      phone: v.phone?.trim() || undefined,
      email: v.email?.trim() || undefined,
      gender: v.gender === '女' ? 'female' : v.gender === '男' ? 'male' : undefined,
      remark: v.remark?.trim() || undefined,
      description: v.remark?.trim() || undefined, // 兼容后端字段
    }
    if (typeof nextOrgId !== 'undefined') payload.orgId = nextOrgId

    await onSubmit(payload)
  }

  return (
    <Modal
      title="修改用户"
      open={open}
      maskClosable={false}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={handleOk}
      okText="确定"
      width={720}
      destroyOnClose
      afterOpenChange={opened => {
        if (opened && mapped) form.setFieldsValue(mapped)
        if (!opened) form.resetFields()
      }}
    >
      <Form form={form} layout="vertical" initialValues={mapped} preserve={false}>
        {/* 两列区域 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 16,
            rowGap: 8,
          }}
        >
          <Form.Item
            label="用户昵称"
            name="nickname"
            rules={[{ required: true, message: '请输入用户昵称' }, { max: 50 }]}
          >
            <Input placeholder="请输入" />
          </Form.Item>

          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }, { max: 50 }]}>
            <Input placeholder="请输入" />
          </Form.Item>

          <Form.Item label="手机号" name="phone" rules={[{ max: 32 }]}>
            <Input placeholder="请输入" />
          </Form.Item>

          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '邮箱格式不正确' }, { max: 128 }]}>
            <Input placeholder="请输入" />
          </Form.Item>

          <Form.Item label="用户性别" name="gender">
            <Select placeholder="请选择">
              <Option value="男">男</Option>
              <Option value="女">女</Option>
            </Select>
          </Form.Item>

          <Form.Item label="归属部门" name="orgId">
            <TreeSelect
              allowClear
              treeData={toTreeOptions(tree)}
              placeholder="请选择归属部门"
              treeDefaultExpandAll={false}
              showSearch
              dropdownStyle={{ maxHeight: 360, overflow: 'auto' }}
            />
          </Form.Item>

          {/* 备注独占两列 */}
          <Form.Item
            label="备注"
            name="remark"
            style={{ gridColumn: '1 / span 2' }}
            rules={[{ max: 500, message: '最多 500 字' }]}
          >
            <Input.TextArea rows={4} placeholder="可填写备注信息" />
          </Form.Item>

          {/* 隐藏：原 orgId，用于保留逻辑 */}
          <Form.Item name="__originalOrgId" hidden>
            <Input />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default EditUserModal
