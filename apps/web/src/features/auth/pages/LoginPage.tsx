import React, { useEffect, useRef } from 'react'
import { Alert, Card, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

import { useAuth } from '@/shared/contexts/AuthContext'
import { useLogin } from '../../auth/hooks/useLogin'
import { DemoAccountsCard } from '../../auth/components/DemoAccountsCard'
import { LoginForm } from '../../auth/components/LoginForm'
import { menuApi } from '@/shared/api/endpoints/menu'
import { useTheme } from '@/app/providers/AntdThemeProvider'
import { AuthTopControls } from '../components/AuthTopControls'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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
  const { mode } = useTheme()
  const { t } = useLanguage()
  const {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    keep7Days,
    setKeep7Days,
    loading,
    submit,
    submitDisabled,
    inputsDisabled,
    isLocked,
    lockRemainingSec, // ✅ 取出剩余秒
    lockCountdownText,
    lockUiHint,
    lockTryRemainSec,
    lockRetryCountdownText,

    captchaRequired,
    captcha,
    setCaptcha,
    captchaImgUrl,
    refreshCaptcha,
    quickLogin,
  } = useLogin()

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
      if (cached && Array.isArray(cached)) go(pickDefaultHome(cached))
      else
        menuApi
          .routeTree()
          .then(tree => go(pickDefaultHome(tree)))
          .catch(() => go('/dashboard'))
    }
  }, [authLoading, user, navigate])

  if (!authLoading && user) return null

  const lockedNow = isLocked && lockRemainingSec > 0 // ✅ 只要还在锁期就显示
  const isDark = mode === 'dark'
  const pageBackground = isDark
    ? 'radial-gradient(circle at 20% -20%, rgba(37,99,235,0.4), transparent 55%), linear-gradient(135deg, #020617 0%, #0b1220 45%, #020617 100%)'
    : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 520,
    boxShadow: isDark ? '0 30px 80px rgba(0,0,0,.55)' : '0 12px 40px rgba(15,23,42,.15)',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.35)'}`,
    background: isDark ? 'rgba(15,23,42,0.92)' : '#ffffff',
    color: isDark ? '#f8fafc' : undefined,
    backdropFilter: 'blur(6px)',
  }
  const accentColor = isDark ? '#60a5fa' : '#1890ff'
  const secondaryTextColor = isDark ? '#94a3b8' : undefined

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background: pageBackground,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AuthTopControls
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
        }}
      />
      <Card style={cardStyle} styles={{ body: { padding: 32 } }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: isDark ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : 'linear-gradient(135deg, #1890ff, #722ed1)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <BookOpen style={{ width: 32, height: 32, color: 'white' }} />
          </div>
          <Title level={2} style={{ marginBottom: 8, color: isDark ? '#f1f5f9' : undefined }}>
            {t('auth.login_title')}
          </Title>
          <Text type="secondary" style={{ color: secondaryTextColor }}>
            {t('auth.no_account')}
            <Link to="/register" style={{ marginLeft: 4, color: accentColor }}>
              {t('auth.register_now')}
            </Link>
          </Text>
        </div>

        {lockedNow && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={lockUiHint}
            description={`请等待 ${lockCountdownText} 后重试`}
          />
        )}

        <DemoAccountsCard onQuickLogin={quickLogin} />

        <LoginForm
          email={email}
          password={password}
          rememberMe={rememberMe}
          keep7Days={keep7Days}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onRememberChange={setRememberMe}
          onKeep7DaysChange={setKeep7Days}
          onSubmit={submit}
          submitDisabled={submitDisabled}
          inputsDisabled={inputsDisabled}
          isLocked={isLocked}
          lockCountdownText={lockCountdownText}
          lockTryRemainSec={lockTryRemainSec}
          lockRetryCountdownText={lockRetryCountdownText}
          captchaRequired={captchaRequired}
          captcha={captcha}
          captchaImgUrl={captchaImgUrl}
          onCaptchaChange={setCaptcha}
          onRefreshCaptcha={refreshCaptcha}
        />
      </Card>
    </div>
  )
}

export default LoginPage
