// src/app/routing/TabsShell.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'

// 这里只渲染路由内容，不再渲染 TabsBar
export default function TabsShell() {
  return <Outlet />
}
