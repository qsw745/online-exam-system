import { Navigate, useLocation } from 'react-router-dom'
import Layout from '@/shared/components/Layout'

export default function ProtectedLayout() {
  const hasToken = !!localStorage.getItem('token')
  const location = useLocation()

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // ✅ 这里不要再传 children；你的 Layout 组件内部已经包含 <Outlet />
  return <Layout />
}
