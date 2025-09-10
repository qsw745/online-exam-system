import { Form, Input, Modal, Radio, Select, TreeSelect } from 'antd'
import React from 'react'
const { Option } = Select

// 过滤掉没有 id 的节点，避免 TreeSelect 报 value=undefined
function toTreeOptions(tree: any[] = []): any[] {
  const dfs = (n: any): any | null => {
    if (n == null || n.id == null) return null // 关键：过滤无 id
    const children = Array.isArray(n.children) ? n.children.map(dfs).filter(Boolean) : undefined
    return { value: n.id, label: n.name, children }
  }
  return tree.map(dfs).filter(Boolean) as any[]
}

export const EditUserModal: React.FC<{
  open: boolean
  user: any | null
  tree: any[]
  onCancel: () => void
  onSubmit: (payload: {
    username: string
    email?: string
    status?: 'active' | 'disabled'
    role?: string
    orgId?: number | null
  }) => Promise<void> | void
}> = ({ open, user, tree, onCancel, onSubmit }) => {
  const [form] = Form.useForm()

  // 统一映射
  const mapped = React.useMemo(() => {
    if (!user) return undefined
    return {
      username: user.username ?? user.name ?? '',
      email: user.email ?? '',
      status: (user.status as 'active' | 'disabled') ?? 'active',
      role: user.role ?? (Array.isArray(user.roles) ? user.roles[0] : undefined),
      // TreeSelect 的受控值建议用 undefined 表示“空”，避免某些版本对 null 的警告
      orgId: user.orgId ?? user.org_id ?? undefined,
    }
  }, [user])

  // 关键点 1：让 Modal 先把内容渲染出来（即使没打开），这样 useForm 一定已连接到 <Form>
  // 关键点 2：用 afterOpenChange 在「完全打开」后再灌值，避免 “useForm 未连接” 警告
  const handleAfterOpenChange = (opened: boolean) => {
    if (opened && mapped) {
      form.setFieldsValue(mapped)
    }
    if (!opened) {
      form.resetFields()
    }
  }

  const handleOk = async () => {
    const v = await form.validateFields()
    await onSubmit({
      username: v.username,
      email: v.email || undefined,
      status: v.status,
      role: v.role || undefined,
      // 允许为空
      orgId: v.orgId ?? null,
    })
  }

  return (
    <Modal
      title="编辑用户"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
      // ⚠️ 你控制台提示要求使用 destroyOnHidden
      destroyOnHidden
      // 让内容提前挂载，确保 form 已连接，避免 setFieldsValue 报警告
      forceRender
      // 打开后统一 setFieldsValue，这个时机最稳
      afterOpenChange={handleAfterOpenChange}
    >
      {/* 用 key 在切换不同用户时强制重建一次内部状态，确保 initialValues 生效 */}
      <Form
        key={user?.id ?? 'new'}
        form={form}
        layout="vertical"
        preserve={false}
        // 备用：初次挂载也给一份初始值（如果 forceRender 导致先挂载，再 open）
        initialValues={mapped}
      >
        <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input autoFocus />
        </Form.Item>

        <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="状态" name="status" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="active">启用</Radio>
            <Radio value="disabled">禁用</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="角色" name="role">
          <Select placeholder="选择角色" allowClear>
            <Option value="student">学生</Option>
            <Option value="teacher">教师</Option>
            <Option value="admin">管理员</Option>
          </Select>
        </Form.Item>

        <Form.Item label="所属机构" name="orgId">
          <TreeSelect
            allowClear
            treeData={toTreeOptions(tree)}
            placeholder="选择所属机构（可留空）"
            treeDefaultExpandAll={false}
            showSearch
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
