import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Layout as AntLayout } from 'antd'
import DynamicSidebar, { MobileSidebar } from './DynamicSidebar'
import Header from './Header'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import { useLanguage } from '../contexts/LanguageContext'


const { Sider, Content } = AntLayout

const Layout: React.FC = () => {
  const {t,language} = useLanguage()
  const { user, loading } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  const isExamPage = location.pathname.match(/^\/exam\/\d+$/)
  
  if (isExamPage) {
    // 考试页面使用简洁布局
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <Outlet />
      </div>
    )
  }
  
  // 如果正在加载或没有用户信息，显示加载状态
  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <LoadingSpinner text="加载用户信息..." />
      </div>
    )
  }
  
  return (
    <AntLayout style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)'
    }}>
      {/* 桌面端侧边栏 */}
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
            zIndex: 100
          }}
          theme="light"
        >
          <DynamicSidebar 
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </Sider>
      )}
      
      {/* 移动端侧边栏 */}
      <MobileSidebar 
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      
      {/* 主布局区域 */}
      <AntLayout style={{
        marginLeft: !isMobile ? (sidebarCollapsed ? 64 : 256) : 0,
        transition: 'margin-left 0.3s'
      }}>
        {/* 头部 */}
        <AntLayout.Header style={{
          padding: 0,
          background: '#ffffff',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <Header 
            onMobileMenuToggle={() => setMobileSidebarOpen(true)}
          />
        </AntLayout.Header>
        
        {/* 主内容 */}
        <Content style={{
          padding: '24px',
          overflow: 'auto',
          background: 'transparent'
        }}>
          <div style={{
            maxWidth: '1280px',
            margin: '0 auto',
            width: '100%'
          }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
