// src/app/routing/ProtectedLayout.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Layout from '@/shared/components/Layout'

export default function ProtectedLayout() {
  const hasToken = !!localStorage.getItem('token')
  const location = useLocation()

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // 登录后使用你的全局 Layout 包裹所有受保护页面
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
