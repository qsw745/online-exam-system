import React, { useEffect, useRef } from 'react'
import { Card, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

import { useAuth } from '@/shared/contexts/AuthContext'
import { useLogin } from '../../auth/hooks/useLogin'
import { DemoAccountsCard } from '../../auth/components/DemoAccountsCard'
import { LoginForm } from '../../auth/components/LoginForm'
import { menuApi } from '@/shared/api/endpoints/menu'

const { Title, Text } = Typography

function pickDefaultHome(tree: any[] | null | undefined): string {
  const isAdminAbs = (abs: string) => abs === '/admin' || abs.startsWith('/admin/')
  let firstPage: string | null = null
  function joinAbs(parentAbs: string, childPath: string | null | undefined): string {
    const raw = (childPath || '').trim()
    if (!raw) return parentAbs || '/'
    if (raw.startsWith('/')) return raw.replace(/\/{2,}/g, '/')
    const base = parentAbs && parentAbs !== '/' ? parentAbs : ''
    return `${base}/${raw}`.replace(/\/{2,}/g, '/')
  }
  const walk = (nodes: any[], parentAbs = ''): string | null => {
    for (const n of nodes || []) {
      if (!n || n.is_disabled) continue
      const abs = joinAbs(parentAbs, n.path)
      if (isAdminAbs(abs)) continue
      if (n.component && !n.is_hidden) {
        if (abs === '/dashboard') return '/dashboard'
        if (!firstPage) firstPage = abs
      }
      if (n.children?.length) {
        const hit = walk(n.children, abs)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(tree || []) || firstPage || '/dashboard'
}

const LoginPage: React.FC = () => {
  const { email, setEmail, password, setPassword, rememberMe, setRememberMe, loading, submit, quickLogin } = useLogin()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const navigatedRef = useRef(false)

  useEffect(() => {
    if (navigatedRef.current) return
    if (!authLoading && user) {
      const cached = menuApi.getRouteTreeCached?.()
      const go = (to: string) => {
        navigatedRef.current = true
        navigate(to, { replace: true, state: { __bump: Date.now() } })
      }
      if (cached && Array.isArray(cached)) {
        go(pickDefaultHome(cached))
      } else {
        menuApi
          .routeTree()
          .then(tree => go(pickDefaultHome(tree)))
          .catch(() => go('/dashboard'))
      }
    }
  }, [authLoading, user, navigate])

  if (!authLoading && user) return null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 500, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #1890ff, #722ed1)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <BookOpen style={{ width: 32, height: 32, color: 'white' }} />
          </div>
          <Title level={2} style={{ marginBottom: 8 }}>
            登录您的账户
          </Title>
          <Text type="secondary">
            还没有账户？
            <Link to="/register" style={{ marginLeft: 4 }}>
              立即注册
            </Link>
          </Text>
        </div>

        <DemoAccountsCard onQuickLogin={quickLogin} />

        <LoginForm
          email={email}
          password={password}
          rememberMe={rememberMe}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onRememberChange={setRememberMe}
          onSubmit={submit}
        />
      </Card>
    </div>
  )
}

export default LoginPage
