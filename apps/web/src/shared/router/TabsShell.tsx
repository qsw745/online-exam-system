import React from 'react'
import { Outlet } from 'react-router-dom'
import { TabsProvider } from '@/shared/contexts/TabsContext'
import { TabsBar } from '@/shared/components/TabsBar'

/** 登录后主内容区域的外层：提供 Tabs 与标签栏 */
export default function TabsShell() {
  return (
    <TabsProvider>
      <TabsBar />
      <Outlet />
    </TabsProvider>
  )
}
