import React, { useState, useEffect } from 'react'
import { Card, List, Badge, Button, Typography, Spin, App, Space } from 'antd'
import { Bell, Check, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

const { Title, Text } = Typography

interface Notification {
  id: number
  title: string
  content: string
  type: 'system' | 'exam' | 'grade' | 'announcement'
  is_read: boolean
  created_at: string
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()

  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await api.get('/notifications')
      setNotifications(response.data.data || [])
    } catch (error) {
      console.error('获取通知失败:', error)
      message.error('获取通知失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count')
      setUnreadCount(response.data.data?.count || 0)
    } catch (error) {
      console.error('获取未读通知数量失败:', error)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, is_read: true } : notif
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      message.success('标记为已读')
    } catch (error) {
      console.error('标记已读失败:', error)
      message.error('标记已读失败')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      )
      setUnreadCount(0)
      message.success('全部标记为已读')
    } catch (error) {
      console.error('批量标记已读失败:', error)
      message.error('批量标记已读失败')
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(prev => prev.filter(notif => notif.id !== id))
      message.success('删除成功')
    } catch (error) {
      console.error('删除通知失败:', error)
      message.error('删除通知失败')
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system': return 'blue'
      case 'exam': return 'orange'
      case 'grade': return 'green'
      case 'announcement': return 'purple'
      default: return 'default'
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'system': return '系统通知'
      case 'exam': return '考试通知'
      case 'grade': return '成绩通知'
      case 'announcement': return '公告'
      default: return '通知'
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space align="center">
          <Bell style={{ width: 24, height: 24, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0 }}>通知中心</Title>
          {unreadCount > 0 && (
            <Badge count={unreadCount} />
          )}
        </Space>
        {unreadCount > 0 && (
          <Button 
            type="primary" 
            icon={<Check style={{ width: 16, height: 16 }} />}
            onClick={markAllAsRead}
          >
            全部标记为已读
          </Button>
        )}
      </div>

      <Card>
        <Spin spinning={loading}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Bell style={{ width: 64, height: 64, color: '#d9d9d9', margin: '0 auto 16px' }} />
              <Text type="secondary">暂无通知</Text>
            </div>
          ) : (
            <List
              dataSource={notifications}
              renderItem={(notification) => (
                <List.Item
                  style={{
                    backgroundColor: !notification.is_read ? '#f0f9ff' : undefined,
                    borderRadius: 8,
                    marginBottom: 8,
                    padding: 16
                  }}
                  actions={[
                    !notification.is_read && (
                      <Button
                        type="text"
                        size="small"
                        icon={<Check style={{ width: 16, height: 16 }} />}
                        onClick={() => markAsRead(notification.id)}
                      >
                        标记已读
                      </Button>
                    ),
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 style={{ width: 16, height: 16 }} />}
                      onClick={() => deleteNotification(notification.id)}
                    >
                      删除
                    </Button>
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={
                      <Space align="center">
                        <span style={{ fontWeight: !notification.is_read ? 600 : 'normal' }}>
                          {notification.title}
                        </span>
                        <Badge 
                          color={getTypeColor(notification.type)} 
                          text={getTypeText(notification.type)}
                        />
                        {!notification.is_read && (
                          <Badge status="processing" />
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <Text style={{ fontWeight: !notification.is_read ? 500 : 'normal' }}>
                          {notification.content}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 14 }}>
                          {new Date(notification.created_at).toLocaleString()}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>
    </div>
  )
}

export default NotificationsPage