import React from 'react'
import { Card, Button, Typography, Space } from 'antd'

import { useTheme } from '@/app/providers/AntdThemeProvider'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Title, Text } = Typography

type Props = {
  onQuickLogin: (email: string, pwd?: string) => void
}

export const DemoAccountsCard: React.FC<Props> = ({ onQuickLogin }) => {
  const { mode } = useTheme()
  const { t } = useLanguage()
  const isDark = mode === 'dark'

  const cardBg = isDark ? 'rgba(15, 23, 42, 0.78)' : '#f0f8ff'
  const cardBorder = isDark ? 'rgba(59, 130, 246, 0.35)' : '#d6e4ff'
  const accent = isDark ? '#93c5fd' : '#1890ff'
  const helperColor = isDark ? '#cbd5f5' : undefined
  const buttonBase: React.CSSProperties = {
    textAlign: 'left',
    height: 'auto',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(59,130,246,0.35)' : 'rgba(24,144,255,0.25)'}`,
    background: isDark ? 'rgba(15,23,42,0.6)' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#0f172a',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,.35)' : '0 6px 18px rgba(15,23,42,.08)',
  }

  const passwordHint = t('auth.demo_password_hint').replace('{password}', 'demo123456')

  return (
    <Card
      size="small"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        marginBottom: 24,
        color: isDark ? '#f8fafc' : undefined,
      }}
    >
      <Title level={5} style={{ marginBottom: 12, color: accent }}>
        {t('auth.demo_quick_login')}
      </Title>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button block size="small" onClick={() => onQuickLogin('admin@demo.com')} style={buttonBase}>
          <div>
            <Text strong style={{ color: accent }}>
              {t('auth.demo_admin')}:{' '}
            </Text>
            <Text style={{ color: accent }}>admin@demo.com</Text>
          </div>
        </Button>
        <Button block size="small" onClick={() => onQuickLogin('teacher@demo.com')} style={buttonBase}>
          <div>
            <Text strong style={{ color: accent }}>
              {t('auth.demo_teacher')}:{' '}
            </Text>
            <Text style={{ color: accent }}>teacher@demo.com</Text>
          </div>
        </Button>
        <Button block size="small" onClick={() => onQuickLogin('student@demo.com')} style={buttonBase}>
          <div>
            <Text strong style={{ color: accent }}>
              {t('auth.demo_student')}:{' '}
            </Text>
            <Text style={{ color: accent }}>student@demo.com</Text>
          </div>
        </Button>
      </Space>
      <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block', color: helperColor }}>
        {passwordHint}
      </Text>
    </Card>
  )
}
