import GlobalWatermark from '@/shared/components/GlobalWatermark'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useAuth } from '@/shared/contexts/AuthContext'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner center="page" text={translate('visible.97c6a5388e')} />
  }

  if (!user) {
    // 仅当非 /login 时跳转，避免来回送
    if (location.pathname !== '/login') {
      return <Navigate to="/login" replace state={{ from: location }} />
    }
    return <Outlet />
  }

  return (
    <GlobalWatermark>
      <Outlet />
    </GlobalWatermark>
  )
}
