import React from 'react'
import { Outlet } from 'react-router-dom'

// 这里只渲染路由内容（TabsBar 如需显示，请在 AppLayout/Header 中单独挂载）
export default function TabsShell() {
  return <Outlet />
}
