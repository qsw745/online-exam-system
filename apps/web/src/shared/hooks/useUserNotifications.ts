import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { notificationsApi, type NotificationDTO } from '@shared/api/endpoints/notifications'

export function useUserNotifications() {
  const { message } = App.useApp()
  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [list, count] = await Promise.all([notificationsApi.list(), notificationsApi.unreadCount()])
      setNotifications(list)
      setUnread(count)
    } catch (e) {
      console.error(e)
      message.error('获取通知失败')
      setNotifications([])
      setUnread(0)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const markRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
      setUnread(v => Math.max(0, v - 1))
      message.success('标记为已读')
    } catch {
      message.error('标记已读失败')
    }
  }

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
      message.success('全部标记为已读')
    } catch {
      message.error('批量标记已读失败')
    }
  }

  const remove = async (id: number) => {
    try {
      await notificationsApi.remove(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      message.success('删除成功')
    } catch {
      message.error('删除通知失败')
    }
  }

  return { notifications, unread, loading, loadAll, markRead, markAllRead, remove }
}
