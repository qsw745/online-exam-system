import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

import LoadingSpinner from '@/shared/components/LoadingSpinner'
import MobileStudentNav from '@/shared/components/MobileStudentNav'
import { useAuth } from '@/shared/contexts/AuthContext'
import { getStudentNavSection, isStudentExamPath } from '@/shared/router/studentNavigation'

import UnsupportedMobileRolePage from './UnsupportedMobileRolePage'

export default function MobileAppLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const section = getStudentNavSection(location.pathname)
  const sectionLabels: Record<string, string> = { '/dashboard': '首页', '/tasks/my': '任务', '/student/learning': '学习', '/profile': '我的' }
  const isSectionHome = location.pathname.replace(/\/$/, '') === section
  const hasPageBackControl = /^\/(?:tasks\/detail|proctoring\/reviews)\//.test(location.pathname)

  if (loading) {
    return <LoadingSpinner center="page" text="正在恢复安全会话…" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role !== 'student') {
    return <UnsupportedMobileRolePage />
  }

  if (isStudentExamPath(location.pathname)) {
    return <Outlet />
  }

  return (
    <>
      <main className="mobile-app-shell">
        {!isSectionHome && !hasPageBackControl && <div className="mobile-app-back-row">
          <Link to={section} aria-label={`返回${sectionLabels[section]}`}><ChevronLeft size={20} aria-hidden="true" />{sectionLabels[section]}</Link>
        </div>}
        <Outlet />
      </main>
      <MobileStudentNav appLayout />
    </>
  )
}
