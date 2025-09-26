import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { Card } from 'antd'
import MenuManagementPage from './MenuManagementPage'

export default function SystemMenusPage() {
  return (
    <>
      <AppBreadcrumb  />
      <Card variant="filled" style={{ height: '100%', minHeight: 520, overflow: 'hidden' }}>
        <MenuManagementPage mode="system" />
      </Card>
    </>
  )
}
