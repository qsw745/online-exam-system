import { Navigate, Outlet, useLocation } from 'react-router-dom'

import LoadingSpinner from '@/shared/components/LoadingSpinner'
import MobileStudentNav from '@/shared/components/MobileStudentNav'
import { useAuth } from '@/shared/contexts/AuthContext'

import UnsupportedMobileRolePage from './UnsupportedMobileRolePage'

export default function MobileAppLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingSpinner center="page" text="正在恢复安全会话…" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role !== 'student') {
    return <UnsupportedMobileRolePage />
  }

  if (/^\/exam\/(?:task\/)?\d+$/.test(location.pathname)) {
    return <Outlet />
  }

  return (
    <>
      <main className="mobile-app-shell">
        <Outlet />
      </main>
      <MobileStudentNav />
    </>
  )
}
