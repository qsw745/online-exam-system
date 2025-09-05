import { Button, Checkbox, Form, Input, Modal, Select, Space } from 'antd'
import { Send } from 'lucide-react'
import type { UserDTO } from '../api/users'
import type { CreateNotificationForm } from '../hooks/useNotifications'
const { TextArea } = Input
const { Option } = Select

export default function NotificationFormModal({
  open,
  onClose,
  form,
  users,
  editing,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  form: any
  users: UserDTO[]
  editing: any
  onSubmit: (v: CreateNotificationForm) => void
}) {
  return (
    <Modal title={editing ? '编辑通知' : '发送通知'} open={open} onCancel={onClose} footer={null} width={600}>
      <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ type: 'info', send_to_all: false }}>
        <Form.Item name="title" label="通知标题" rules={[{ required: true, message: '请输入通知标题' }]}>
          <Input placeholder="请输入通知标题" />
        </Form.Item>
        <Form.Item name="content" label="通知内容" rules={[{ required: true, message: '请输入通知内容' }]}>
          <TextArea rows={4} placeholder="请输入通知内容" showCount maxLength={500} />
        </Form.Item>
        <Form.Item name="type" label="通知类型" rules={[{ required: true, message: '请选择通知类型' }]}>
          <Select placeholder="请选择通知类型">
            <Option value="info">信息</Option>
            <Option value="success">成功</Option>
            <Option value="warning">警告</Option>
            <Option value="error">错误</Option>
          </Select>
        </Form.Item>

        {/* 编辑时不展示分发范围（只改内容与类型） */}
        {!editing && (
          <>
            <Form.Item name="send_to_all" valuePropName="checked">
              <Checkbox>发送给所有用户</Checkbox>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.send_to_all !== c.send_to_all}>
              {({ getFieldValue }) => {
                const sendAll = getFieldValue('send_to_all')
                return sendAll ? (
                  <Form.Item name="role_filter" label="角色筛选（可选）">
                    <Select placeholder="选择角色筛选，不选则发送给所有用户" allowClear>
                      <Option value="admin">管理员</Option>
                      <Option value="teacher">教师</Option>
                      <Option value="student">学生</Option>
                    </Select>
                  </Form.Item>
                ) : (
                  <Form.Item name="user_ids" label="接收用户" rules={[{ required: true, message: '请选择接收用户' }]}>
                    <Select mode="multiple" placeholder="请选择接收通知的用户" showSearch optionFilterProp="children">
                      {users.map(u => (
                        <Option key={u.id} value={u.id}>
                          {u.real_name || u.username}（{u.role}）
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }}
            </Form.Item>
          </>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" htmlType="submit" icon={<Send style={{ width: 16, height: 16 }} />}>
              {editing ? '更新' : '发送'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
