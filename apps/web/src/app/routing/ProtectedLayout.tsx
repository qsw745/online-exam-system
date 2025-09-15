import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useAuth } from '@/shared/contexts/AuthContext'

export default function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <LoadingSpinner />
      </div>
    )
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
