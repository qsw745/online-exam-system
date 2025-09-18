import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useAuth } from '@/shared/contexts/AuthContext'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner center="page" text="验证中…" />
  }

  if (!user) {
    // 仅当非 /login 时跳转，避免来回送
    if (location.pathname !== '/login') {
      return <Navigate to="/login" replace state={{ from: location }} />
    }
    return <Outlet />
  }

  return <Outlet />
}
