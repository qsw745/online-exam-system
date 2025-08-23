import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import DynamicSidebar, { MobileSidebar } from './DynamicSidebar'
import Header from './Header'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

const Layout: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  const isExamPage = location.pathname.match(/^\/exam\/\d+$/)
  
  if (isExamPage) {
    // 考试页面使用简洁布局
    return (
      <div className="min-h-screen bg-white">
        <Outlet />
      </div>
    )
  }
  
  // 如果正在加载或没有用户信息，显示加载状态
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <LoadingSpinner text="加载用户信息..." />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex h-screen">
        {/* 桌面端动态侧边栏 */}
        <DynamicSidebar 
          className={`hidden md:block transition-all duration-300 ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        {/* 移动端侧边栏 */}
        <MobileSidebar 
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
        
        {/* 主内容区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 头部 */}
          <Header 
            onMobileMenuToggle={() => setMobileSidebarOpen(true)}
          />
          
          {/* 主内容 */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout
