import { Badge, Button, Space, Typography } from 'antd'
import { Bell, Check } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'

const { Title } = Typography

export default function NotificationsToolbar({ unread, onMarkAll }: { unread: number; onMarkAll: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <Space align="center">
        <Bell style={{ width: 24, height: 24, color: '#1890ff' }} />
        <Title level={2} style={{ margin: 0 }}>
          {translate('menus.notify-center')}</Title>
        {unread > 0 && <Badge count={unread} />}
      </Space>
      {unread > 0 && (
        <Button type="primary" icon={<Check style={{ width: 16, height: 16 }} />} onClick={onMarkAll}>
          {translate('auto.60efec89e1')}</Button>
      )}
    </div>
  )
}
