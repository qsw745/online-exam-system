import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Typography } from 'antd'
import { BookOpen } from 'lucide-react'
import { RegisterForm } from '../../auth/components/RegisterForm'
import { useRegister } from '../../auth/hooks/useRegister'
import { useLanguage } from '@shared/contexts/LanguageContext'

const { Title, Text } = Typography

const RegisterPage: React.FC = () => {
  const { loading, submit } = useRegister('student') // 默认注册为 student
  const { t } = useLanguage()

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
            创建新账户
          </Title>
          <Text type="secondary">
            已有账户？
            <Link to="/login" style={{ marginLeft: 4 }}>
              立即登录
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
