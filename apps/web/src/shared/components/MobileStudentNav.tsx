import { BookOpenCheck, CircleUserRound, ClipboardList, House } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getStudentNavSection, isStudentExamPath } from '@/shared/router/studentNavigation'

export type MobileNavVisibilityInput = {
  role?: string | null
  pathname: string
  isMobile: boolean
}

export function shouldShowMobileStudentNav({ role, pathname, isMobile }: MobileNavVisibilityInput) {
  const examRoute = isStudentExamPath(pathname)
  return isMobile && role === 'student' && !examRoute
}

const items = [
  { to: '/dashboard', label: '首页', icon: House, end: true },
  { to: '/tasks/my', label: '任务', icon: ClipboardList },
  { to: '/student/learning', label: '学习', icon: BookOpenCheck },
  { to: '/profile', label: '我的', icon: CircleUserRound },
]

export default function MobileStudentNav({ appLayout = false }: { appLayout?: boolean }) {
  const { pathname } = useLocation()
  const activeSection = getStudentNavSection(pathname)
  return (
    <nav className={`mobile-student-nav${appLayout ? ' mobile-student-nav--app' : ''}`} aria-label="考生主导航">
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} aria-current={activeSection === to ? 'page' : undefined} className="mobile-student-nav__item">
          <Icon size={21} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
