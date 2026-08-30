import DynamicSidebar, { MobileSidebar } from '@/app/routing/DynamicSidebar'
import { TabsBar } from '@/shared/components/TabsBar'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLayout } from '@/shared/contexts/LayoutContext'
import { TabsProvider } from '@/shared/contexts/TabsContext'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'
import { Layout as AntLayout, theme } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import LoadingSpinner from './LoadingSpinner'
import LayoutOffsetVars from './LayoutOffsetVars'
import AiAssistantWidget from './AiAssistantWidget'
import { translate } from '@/shared/utils/i18n'
import MobileStudentNav, { shouldShowMobileStudentNav } from './MobileStudentNav'

const { Content } = AntLayout
const HEADER_H = 48
const TABS_H = 40

const Layout: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { mode, showTabs } = useLayout()
  const { token } = theme.useToken()

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isExamPage = useMemo(() => /^\/exam\/(?:task\/)?\d+$/.test(location.pathname), [location.pathname])

  if (isExamPage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <RefreshableOutlet />
      </div>
    )
  }

  if (loading || !user) {
    return <LoadingSpinner center="page" text={translate('visible.4f42c81a77')} />
  }

  const showStudentMobileNav = shouldShowMobileStudentNav({
    role: user.role,
    pathname: location.pathname,
    isMobile,
  })
  const visibleTabs = showTabs && !showStudentMobileNav
  const headTotal = HEADER_H + (visibleTabs ? TABS_H : 0)

  return (
    <TabsProvider>
      <LayoutOffsetVars />
      <Header onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
      {visibleTabs && <TabsBar />}

      {!isMobile && (mode === 'side' || mode === 'mix') && <DynamicSidebar /* 你的 props 不变 */ />}
      <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <AntLayout
        style={{
          minHeight: '100vh',
          background: token.colorBgLayout,
          color: token.colorText,
          paddingTop: headTotal,
          marginLeft: isMobile ? 0 : 'var(--sider-width, 0px)',
          transition: 'margin-left .2s ease',
        }}
      >
        <AntLayout>
          <Content
            className={showStudentMobileNav ? 'app-content app-content--student-mobile' : 'app-content'}
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
      {!showStudentMobileNav && <AiAssistantWidget />}
      {showStudentMobileNav && <MobileStudentNav />}
    </TabsProvider>
  )
}

export default Layout
