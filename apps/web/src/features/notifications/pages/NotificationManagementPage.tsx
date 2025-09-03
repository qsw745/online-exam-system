import {
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Bell, Edit, Plus, Send, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { api } from '@shared/api/http'
import { createPaginationConfig } from '@shared/constants/pagination'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface User {
  id: number
  username: string
  real_name: string
  role: string
}

interface Notification {
  id: number
  user_id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_read: boolean
  created_at: string
  updated_at: string
  user?: {
    username: string
    real_name: string
  }
}

interface CreateNotificationForm {
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  user_ids?: number[]
  send_to_all?: boolean
  role_filter?: string
}

const NotificationManagementPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [form] = Form.useForm<CreateNotificationForm>()
  const { message } = App.useApp()

  useEffect(() => {
    fetchNotifications()
    fetchUsers()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await api.get('/notifications/admin/list')
      if (response.success) {
        setNotifications(response.data || [])
      } else {
        message.error('获取通知列表失败')
      }
    } catch (error) {
      console.error('获取通知列表失败:', error)
      message.error('获取通知列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users')
      if (response.success) {
        setUsers(response.data?.users || [])
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
    }
  }

  const handleCreate = () => {
    setEditingNotification(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification)
    form.setFieldsValue({
      title: notification.title,
      content: notification.content,
      type: notification.type,
    })
    setModalVisible(true)
  }

  const handleSubmit = async (values: CreateNotificationForm) => {
    try {
      if (values.send_to_all) {
        // 批量发送给所有用户或指定角色的用户
        let targetUserIds = users.map(user => user.id)

        if (values.role_filter) {
          targetUserIds = users.filter(user => user.role === values.role_filter).map(user => user.id)
        }

        const response = await api.post('/notifications/batch', {
          user_ids: targetUserIds,
          title: values.title,
          content: values.content,
          type: values.type,
        })

        if (response.success) {
          message.success(`成功发送通知给 ${response.data.count} 个用户`)
        } else {
          message.error('发送通知失败')
        }
      } else if (values.user_ids && values.user_ids.length > 0) {
        // 发送给指定用户
        if (values.user_ids.length === 1) {
          const response = await api.post('/notifications', {
            user_id: values.user_ids[0],
            title: values.title,
            content: values.content,
            type: values.type,
          })

          if (response.success) {
            message.success('通知发送成功')
          } else {
            message.error('发送通知失败')
          }
        } else {
          const response = await api.post('/notifications/batch', {
            user_ids: values.user_ids,
            title: values.title,
            content: values.content,
            type: values.type,
          })

          if (response.success) {
            message.success(`成功发送通知给 ${response.data.count} 个用户`)
          } else {
            message.error('发送通知失败')
          }
        }
      } else {
        message.error('请选择接收通知的用户')
        return
      }

      setModalVisible(false)
      form.resetFields()
      fetchNotifications()
    } catch (error) {
      console.error('发送通知失败:', error)
      message.error('发送通知失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await api.delete(`/notifications/admin/${id}`)
      if (response.success) {
        message.success('删除成功')
        fetchNotifications()
      } else {
        message.error('删除失败')
      }
    } catch (error) {
      console.error('删除通知失败:', error)
      message.error('删除失败')
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      info: 'blue',
      success: 'green',
      warning: 'orange',
      error: 'red',
    }
    return colors[type as keyof typeof colors] || 'blue'
  }

  const getTypeText = (type: string) => {
    const texts = {
      info: '信息',
      success: '成功',
      warning: '警告',
      error: '错误',
    }
    return texts[type as keyof typeof texts] || '信息'
  }

  const columns: ColumnsType<Notification> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ maxWidth: 300 }} ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => <Tag color={getTypeColor(type)}>{getTypeText(type)}</Tag>,
    },
    {
      title: '接收用户',
      dataIndex: 'user',
      key: 'user',
      width: 120,
      render: (user: any) => <Text>{user?.real_name || user?.username || '未知用户'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 80,
      render: (isRead: boolean) => <Tag color={isRead ? 'green' : 'orange'}>{isRead ? '已读' : '未读'}</Tag>,
    },
    {
      title: '发送时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<Edit style={{ width: 16, height: 16 }} />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条通知吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<Trash2 style={{ width: 16, height: 16 }} />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space align="center">
          <Bell style={{ width: 24, height: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>
            通知管理
          </Title>
        </Space>
        <Button type="primary" icon={<Plus style={{ width: 16, height: 16 }} />} onClick={handleCreate}>
          发送通知
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={notifications}
          rowKey="id"
          loading={loading}
          pagination={{
            total: notifications.length,
            pageSize: 10,
            ...createPaginationConfig(),
          }}
        />
      </Card>

      <Modal
        title={editingNotification ? '编辑通知' : '发送通知'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'info',
            send_to_all: false,
          }}
        >
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

          {!editingNotification && (
            <>
              <Form.Item name="send_to_all" valuePropName="checked">
                <Checkbox>发送给所有用户</Checkbox>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.send_to_all !== currentValues.send_to_all}
              >
                {({ getFieldValue }) => {
                  const sendToAll = getFieldValue('send_to_all')

                  if (sendToAll) {
                    return (
                      <Form.Item name="role_filter" label="角色筛选（可选）">
                        <Select placeholder="选择角色筛选，不选则发送给所有用户" allowClear>
                          <Option value="admin">管理员</Option>
                          <Option value="teacher">教师</Option>
                          <Option value="student">学生</Option>
                        </Select>
                      </Form.Item>
                    )
                  } else {
                    return (
                      <Form.Item
                        name="user_ids"
                        label="接收用户"
                        rules={[{ required: true, message: '请选择接收通知的用户' }]}
                      >
                        <Select
                          mode="multiple"
                          placeholder="请选择接收通知的用户"
                          showSearch
                          optionFilterProp="children" // ✅ 用 children 作为搜索字段
                        >
                          {users.map(user => (
                            <Option key={user.id} value={user.id}>
                              {user.real_name || user.username} ({user.role})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )
                  }
                }}
              </Form.Item>
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setModalVisible(false)
                  form.resetFields()
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" icon={<Send style={{ width: 16, height: 16 }} />}>
                {editingNotification ? '更新' : '发送'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotificationManagementPage
