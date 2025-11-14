import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Typography } from 'antd'
import { BookOpen } from 'lucide-react'
import { RegisterForm } from '../components/RegisterForm'
import { useRegister } from '../hooks/useRegister'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useTheme } from '@/app/providers/AntdThemeProvider'
import { AuthTopControls } from '../components/AuthTopControls'

const { Title, Text } = Typography

const RegisterPage: React.FC = () => {
  const { loading, submit } = useRegister()
  const { t } = useLanguage()
  const { mode } = useTheme()

  const isDark = mode === 'dark'
  const pageBackground = isDark
    ? 'radial-gradient(circle at 80% -20%, rgba(59,130,246,0.45), transparent 55%), linear-gradient(135deg, #010409 0%, #0b1220 45%, #020617 100%)'
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
      <Card style={cardStyle} bodyStyle={{ padding: 32 }}>
        {/* Logo & 标题 */}
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
            {t('auth.register_title')}
          </Title>
          <Text type="secondary" style={{ color: secondaryTextColor }}>
            {t('auth.has_account')}
            <Link to="/login" style={{ marginLeft: 4, color: accentColor }}>
              {t('auth.login_now')}
            </Link>
          </Text>
        </div>

        {/* 表单 */}
        <RegisterForm loading={loading} onSubmit={submit} t={t} />
      </Card>
    </div>
  )
}

export default RegisterPage
