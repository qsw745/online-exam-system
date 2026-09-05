import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/styles/mobile-foundation.css'

import MobileAppLayout from './MobileAppLayout'

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string },
  loading: false,
}))

vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

function renderLayout(pathname = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/login" element={<div>登录页</div>} />
        <Route element={<MobileAppLayout />}>
          <Route path="/dashboard" element={<div>学生首页内容</div>} />
          <Route path="/exam/:id" element={<div>考试内容</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('MobileAppLayout', () => {
  beforeEach(() => {
    authState.user = null
    authState.loading = false
  })

  it('学生可以进入考生页面并看到考生主导航', () => {
    authState.user = { id: 'student-1', email: 'student@example.com', role: 'student' }

    renderLayout()

    const pageContent = screen.getByText('学生首页内容')
    const appShell = pageContent.closest('main')

    expect(pageContent).toBeInTheDocument()
    expect(appShell).not.toBeNull()
    // 安全区的 env()/max() 布局由浏览器检查，jsdom 不计算这些 CSS 值。
    expect(appShell).toHaveClass('mobile-app-shell')
    expect(screen.getByRole('navigation', { name: '考生主导航' })).toHaveClass('mobile-student-nav--app')
    expect(screen.getByRole('navigation', { name: '考生主导航' })).toBeInTheDocument()
  })

  it.each(['teacher', 'admin'])('%s 不加载后台菜单并显示 Web 后台指引', (role) => {
    authState.user = { id: `${role}-1`, email: `${role}@example.com`, role }

    renderLayout()

    expect(screen.getByText('教师与管理员请使用问衡 Web 后台')).toBeInTheDocument()
    expect(screen.queryByText('学生首页内容')).not.toBeInTheDocument()
    expect(screen.queryByText('系统管理')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '考生主导航' })).not.toBeInTheDocument()
  })

  it('未登录时转到登录页', () => {
    renderLayout()

    expect(screen.getByText('登录页')).toBeInTheDocument()
  })

  it('考试页面保持沉浸模式且不显示底部导航', () => {
    authState.user = { id: 'student-1', email: 'student@example.com', role: 'student' }

    renderLayout('/exam/42')

    expect(screen.getByText('考试内容')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '考生主导航' })).not.toBeInTheDocument()
  })
})
