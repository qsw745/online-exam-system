// src/shared/components/Layout.tsx
import DynamicSidebar, { MobileSidebar } from '@/app/routing/DynamicSidebar'
import { useAuth } from '@/shared/contexts/AuthContext'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'
import { Layout as AntLayout } from 'antd'
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import LoadingSpinner from './LoadingSpinner'

// ✅ 引入 TabsProvider（你刚刚新建的 TabsContext 里的 Provider）
import { TabsProvider } from '@/shared/contexts/TabsContext'

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

  // 考试页面不走布局（不需要 Tabs）
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
    // ✅ 关键：把使用 useTabs 的所有子树（侧栏、内容等）包在 TabsProvider 里
    <TabsProvider>
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
          {/* 你自己的 Tabs 可视化组件（如果有）也要放在 TabsProvider 里面 */}
          {/* <TabsBar /> */}

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
    </TabsProvider>
  )
}

export default Layout
