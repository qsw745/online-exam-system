import { BookOpenCheck, CircleUserRound, ClipboardList, House } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export type MobileNavVisibilityInput = {
  role?: string | null
  pathname: string
  isMobile: boolean
}

export function shouldShowMobileStudentNav({ role, pathname, isMobile }: MobileNavVisibilityInput) {
  const examRoute = /^\/exam\/(?:task\/)?\d+/.test(pathname)
  return isMobile && role === 'student' && !examRoute
}

const items = [
  { to: '/dashboard', label: '首页', icon: House, end: true },
  { to: '/tasks/my', label: '任务', icon: ClipboardList },
  { to: '/student/learning', label: '学习', icon: BookOpenCheck },
  { to: '/profile', label: '我的', icon: CircleUserRound },
]

export default function MobileStudentNav() {
  return (
    <nav className="mobile-student-nav" aria-label="考生主导航">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="mobile-student-nav__item">
          <Icon size={21} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
