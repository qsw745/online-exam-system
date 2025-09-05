import { Button, Space, Typography } from 'antd'
import { Bell, Plus } from 'lucide-react'
const { Title } = Typography

export default function NotificationToolbar({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <Space align="center">
        <Bell style={{ width: 24, height: 24, color: '#1890ff' }} />
        <Title level={2} style={{ margin: 0 }}>
          通知管理
        </Title>
      </Space>
      <Button type="primary" icon={<Plus style={{ width: 16, height: 16 }} />} onClick={onCreate}>
        发送通知
      </Button>
    </div>
  )
}
