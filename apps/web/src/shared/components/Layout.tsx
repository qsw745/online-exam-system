// src/shared/components/Layout.tsx
import DynamicSidebar, { MobileSidebar } from '@/app/routing/DynamicSidebar'
import { useAuth } from '@/shared/contexts/AuthContext'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'
import { Layout as AntLayout } from 'antd'
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import LoadingSpinner from './LoadingSpinner'
import { TabsProvider } from '@/shared/contexts/TabsContext'
import { TabsBar } from '@/shared/components/TabsBar'

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
    return <LoadingSpinner center="page" text="加载用户信息…" />
  }

  return (
    // ✅ 只在这里包一层 TabsProvider（全局唯一）
    <TabsProvider>
      <Header onMobileMenuToggle={() => setMobileSidebarOpen(true)} />

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
              zIndex: 100,
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
          {/* ✅ 在内容上方渲染一次 TabsBar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0',marginTop:'5px' ,marginLeft:'16px'}}>
            <TabsBar />
          </div>

          <Content
            style={{
              padding: '8px 16px',
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
    </TabsProvider>
  )
}

export default Layout
