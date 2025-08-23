import React, { useState, useEffect } from 'react'
import { Card, List, Badge, Button, Typography, Spin, App } from 'antd'
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

export default function NotificationsPage() {
  const { message } = App.useApp()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Bell className="w-6 h-6 text-blue-600" />
          <Title level={2} className="!mb-0">通知中心</Title>
          {unreadCount > 0 && (
            <Badge count={unreadCount} className="ml-2" />
          )}
        </div>
        {unreadCount > 0 && (
          <Button 
            type="primary" 
            icon={<Check className="w-4 h-4" />}
            onClick={markAllAsRead}
          >
            全部标记为已读
          </Button>
        )}
      </div>

      <Card>
        <Spin spinning={loading}>
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <Text type="secondary">暂无通知</Text>
            </div>
          ) : (
            <List
              dataSource={notifications}
              renderItem={(notification) => (
                <List.Item
                  className={`${!notification.is_read ? 'bg-blue-50' : ''} rounded-lg mb-2 p-4`}
                  actions={[
                    !notification.is_read && (
                      <Button
                        type="text"
                        size="small"
                        icon={<Check className="w-4 h-4" />}
                        onClick={() => markAsRead(notification.id)}
                      >
                        标记已读
                      </Button>
                    ),
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => deleteNotification(notification.id)}
                    >
                      删除
                    </Button>
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={
                      <div className="flex items-center space-x-2">
                        <span className={!notification.is_read ? 'font-semibold' : ''}>
                          {notification.title}
                        </span>
                        <Badge 
                          color={getTypeColor(notification.type)} 
                          text={getTypeText(notification.type)}
                        />
                        {!notification.is_read && (
                          <Badge status="processing" />
                        )}
                      </div>
                    }
                    description={
                      <div>
                        <Text className={!notification.is_read ? 'font-medium' : ''}>
                          {notification.content}
                        </Text>
                        <br />
                        <Text type="secondary" className="text-sm">
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