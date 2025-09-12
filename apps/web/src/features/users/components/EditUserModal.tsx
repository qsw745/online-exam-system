import { Form, Input, Modal, Radio, Select, TreeSelect } from 'antd'
import React from 'react'
const { Option } = Select

// 过滤掉没有 id 的节点，避免 TreeSelect 报 value=undefined
function toTreeOptions(tree: any[] = []): any[] {
  const dfs = (n: any): any | null => {
    if (n == null || n.id == null) return null
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
    email?: string
    status?: 'active' | 'disabled'
    role?: string
    orgId?: number | null
  }) => Promise<void> | void
}> = ({ open, user, tree, onCancel, onSubmit }) => {
  const [form] = Form.useForm()

  // —— 统一映射（回显所需字段）——
  const mapped = React.useMemo(() => {
    if (!user) return undefined
    const originalOrgId =
      typeof user.orgId === 'number' ? user.orgId : typeof user.org_id === 'number' ? user.org_id : undefined
    return {
      username: user.username ?? user.name ?? '',
      email: user.email ?? '',
      status: (user.status as 'active' | 'disabled') ?? 'active',
      role: user.role ?? (Array.isArray(user.roles) ? user.roles[0] : undefined),
      orgId: originalOrgId, // 回显用
      __originalOrgId: originalOrgId, // 提交时比对
    }
  }, [user])

  // 让内容提前挂载，确保 form 已连接；完全打开后再灌值，保证回显稳定
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
    // 原始 orgId（入参用户携带的机构）
    const originalOrgId: number | undefined = form.getFieldValue('__originalOrgId')

    // 用户表单里当前的 orgId
    let nextOrgId: number | null | undefined =
      typeof v.orgId === 'number' ? v.orgId : v.orgId == null ? undefined : Number(v.orgId)

    /**
     * 关键修复：
     * - 如果用户“没有改动”orgId（TreeSelect 没选、也没清空），Form 值会是 undefined，
     *   这种情况我们“保留原值”，避免把 undefined 变成 null 导致后端把组织移除。
     * - 只有用户明确选择了新机构（number）时才提交这个新值。
     * - 如果你未来需要“允许显式移除机构”，应该做一个单独的“移除所属机构”的确认操作，
     *   这里不把 undefined 自动当作移除。
     */
    if (typeof nextOrgId === 'undefined') {
      nextOrgId = typeof originalOrgId === 'number' ? originalOrgId : undefined
    }

    const payload: any = {
      username: v.username,
      email: v.email || undefined,
      status: v.status,
      role: v.role || undefined,
    }

    // 仅在我们有明确的机构值时才带上 orgId 字段（避免无意触发移除）
    if (typeof nextOrgId !== 'undefined') {
      payload.orgId = nextOrgId // 可能是 number（保持/修改），也可能是 null（未来若你允许清空时再放开）
    }

    await onSubmit(payload)
  }

  return (
    <Modal
      title="编辑用户"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="保存"
      destroyOnHidden
      forceRender
      afterOpenChange={handleAfterOpenChange}
    >
      <Form key={user?.id ?? 'new'} form={form} layout="vertical" preserve={false} initialValues={mapped}>
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

        {/* 保存一个隐藏字段用于记录原始 orgId，避免误清空 */}
        <Form.Item name="__originalOrgId" hidden>
          <Input />
        </Form.Item>

        <Form.Item label="所属机构" name="orgId">
          <TreeSelect
            allowClear
            treeData={toTreeOptions(tree)}
            placeholder="选择所属机构（不改则保留原有）"
            treeDefaultExpandAll={false}
            showSearch
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default EditUserModal
