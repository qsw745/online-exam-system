import DynamicSidebar, { MobileSidebar } from '@/app/routing/DynamicSidebar'
import { Layout as AntLayout } from 'antd'
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import { useAuth } from '@/shared/contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'

const { Sider, Content } = AntLayout
const HEADER_HEIGHT = 56

const Layout: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isExamPage = /^\/exam\/\d+$/.test(location.pathname)

  if (isExamPage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <RefreshableOutlet />
      </div>
    )
  }

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingSpinner text="加载用户信息..." />
      </div>
    )
  }

  return (
    <>
      {/* 固定顶栏，覆盖左侧 Sider 顶部 */}
      <Header onMobileMenuToggle={() => setMobileSidebarOpen(true)} />

      {/* 主体整体下移，避免被顶栏遮挡 */}
      <AntLayout
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
          paddingTop: HEADER_HEIGHT,
        }}
      >
        {!isMobile && (
          <Sider
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            width={256}
            collapsedWidth={64}
            style={{
              height: '100vh',
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100, // Header(2000) 会覆盖它
              background: '#fff',
            }}
            theme="light"
          >
            <DynamicSidebar collapsed={sidebarCollapsed} />
          </Sider>
        )}

        <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

        <AntLayout
          style={{
            marginLeft: !isMobile ? (sidebarCollapsed ? 64 : 256) : 0,
            transition: 'margin-left 0.3s',
          }}
        >
          <Content
            style={{
              padding: 24,
              overflow: 'auto',
              background: 'transparent',
            }}
          >
            <div style={{ margin: '0 auto', width: '100%' }}>
              <RefreshableOutlet />
            </div>
          </Content>
        </AntLayout>
      </AntLayout>
    </>
  )
}

export default Layout
