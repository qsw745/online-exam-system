// apps/web/src/features/menu/pages/SystemMenusPage.tsx
import { Card } from 'antd'
import MenuManagementPage from './MenuManagementPage'

export default function SystemMenusPage() {
  return (
    <Card variant="outlined" style={{ height: '100%', minHeight: 520, overflow: 'hidden' }}>
      <MenuManagementPage mode="system" />
    </Card>
  )
}
