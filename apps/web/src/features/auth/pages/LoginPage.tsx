import React from 'react'
import { Card, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

import { useLogin } from '../../auth/hooks/useLogin'
import { DemoAccountsCard } from '../../auth/components/DemoAccountsCard'
import { LoginForm } from '../../auth/components/LoginForm'

const { Title, Text } = Typography

const LoginPage: React.FC = () => {
  const { email, setEmail, password, setPassword, rememberMe, setRememberMe, loading, submit, quickLogin } = useLogin()

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
      <Card
        style={{
          width: '100%',
          maxWidth: 500,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Logo & 标题 */}
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

        {/* 演示账号 */}
        <DemoAccountsCard onQuickLogin={quickLogin} />

        {/* 登录表单 */}
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
