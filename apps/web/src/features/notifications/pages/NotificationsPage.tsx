import { Card, Spin } from 'antd'
import NotificationsToolbar from '../components/NotificationsToolbar'
import NotificationsList from '../components/NotificationsList'
import { useUserNotifications } from '../hooks/useUserNotifications'

export default function NotificationsPage() {
  const { notifications, unread, loading, markRead, markAllRead, remove } = useUserNotifications()

  return (
    <div style={{ padding: 24 }}>
      <NotificationsToolbar unread={unread} onMarkAll={markAllRead} />
      <Card>
        <Spin spinning={loading}>
          <NotificationsList data={notifications} loading={loading} onMarkRead={markRead} onRemove={remove} />
        </Spin>
      </Card>
    </div>
  )
}
