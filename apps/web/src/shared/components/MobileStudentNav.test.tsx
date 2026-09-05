import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import MobileStudentNav, { shouldShowMobileStudentNav, type MobileNavVisibilityInput } from './MobileStudentNav'

describe('MobileStudentNav', () => {
  it.each<[MobileNavVisibilityInput, boolean]>([
    [{ role: 'student', pathname: '/dashboard', isMobile: true }, true],
    [{ role: 'teacher', pathname: '/dashboard', isMobile: true }, false],
    [{ role: 'admin', pathname: '/dashboard', isMobile: true }, false],
    [{ role: 'student', pathname: '/exam/12', isMobile: true }, false],
    [{ role: 'student', pathname: '/exam/task/12', isMobile: true }, false],
    [{ role: 'student', pathname: '/exam/task/12/', isMobile: true }, false],
    [{ role: 'student', pathname: '/exam/results', isMobile: true }, true],
    [{ role: 'student', pathname: '/dashboard', isMobile: false }, false],
  ])('对 %o 返回 %s', (input, expected) => {
    expect(shouldShowMobileStudentNav(input)).toBe(expected)
  })

  it.each([
    ['/tasks/detail/42', '任务'],
    ['/learning/favorites', '学习'],
    ['/questions/42/practice', '学习'],
    ['/wrong-questions', '学习'],
    ['/settings', '我的'],
    ['/results/7', '我的'],
    ['/exam/results', '我的'],
    ['/proctoring/reviews/7', '我的'],
  ])('%s 保持对应主导航选中', (path, label) => {
    render(<MemoryRouter initialEntries={[path]}><MobileStudentNav /></MemoryRouter>)
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(1)
  })

  it('呈现四个明确的考生入口', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MobileStudentNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: '考生主导航' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: '学习' })).toHaveAttribute('href', '/student/learning')
  })
})
