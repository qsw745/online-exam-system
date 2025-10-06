import DynamicSidebar, { MobileSidebar } from '@/app/routing/DynamicSidebar'
import { TabsBar } from '@/shared/components/TabsBar'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLayout } from '@/shared/contexts/LayoutContext'
import { TabsProvider } from '@/shared/contexts/TabsContext'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'
import { Layout as AntLayout } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import LoadingSpinner from './LoadingSpinner'
import LayoutOffsetVars from './LayoutOffsetVars'

const { Content } = AntLayout
const HEADER_H = 48
const TABS_H = 40

const Layout: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { mode, showTabs } = useLayout()

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isExamPage = useMemo(() => /^\/exam\/\d+$/.test(location.pathname), [location.pathname])

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

  const headTotal = HEADER_H + (showTabs ? TABS_H : 0)

  return (
    <TabsProvider>
      <LayoutOffsetVars />
      <Header onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
      {showTabs && <TabsBar />}

      {!isMobile && (mode === 'side' || mode === 'mix') && <DynamicSidebar /* 你的 props 不变 */ />}
      <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <AntLayout
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
          paddingTop: headTotal,
          // ❌ 以前：marginLeft: '240px'
          // ✅ 现在：吃变量（top 模式=0；side/mix=64/240）
          marginLeft: 'var(--sider-width, 0px)',
          transition: 'margin-left .2s ease',
        }}
      >
        <AntLayout>
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
