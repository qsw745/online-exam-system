import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { notificationsApi, type NotificationDTO } from '@/shared/api/endpoints/notifications'
import { translate } from '@/shared/utils/i18n'

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
      message.error(translate('auto.9f31b87db7'))
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
      message.success(translate('auto.6cc55eb91b'))
    } catch {
      message.error(translate('auto.b46ca948bf'))
    }
  }

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnread(0)
      message.success(translate('auto.60efec89e1'))
    } catch {
      message.error(translate('auto.573581a323'))
    }
  }

  const remove = async (id: number) => {
    try {
      await notificationsApi.remove(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      message.success(translate('users.message.delete_success'))
    } catch {
      message.error(translate('auto.a432ce2a37'))
    }
  }

  return { notifications, unread, loading, loadAll, markRead, markAllRead, remove }
}
