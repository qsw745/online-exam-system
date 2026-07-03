import React from 'react'
import { Card, Alert, Typography, Space } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { ResetStatusCard } from '../../auth/components/ResetStatusCard'
import { ResetPasswordForm } from '../../auth/components/ResetPasswordForm'
import { useResetPassword } from '../../auth/hooks/useResetPassword'
import { translate } from '@/shared/utils/i18n'

const { Title, Text } = Typography

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
}

const ResetPasswordPage: React.FC = () => {
  const [sp] = useSearchParams()
  const rawToken = sp.get('token') // 只取原始值
  const { status, error, loading, submit, countdown, clearError } = useResetPassword(rawToken)

  return (
    <div style={shellStyle}>
      <Card style={cardStyle}>
        {status === 'validating' && <ResetStatusCard variant="validating" />}
        {status === 'invalid' && <ResetStatusCard variant="invalid" message={error || undefined} />}
        {status === 'success' && <ResetStatusCard variant="success" countdown={countdown} />}

        {status === 'form' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <Title level={2} style={{ marginBottom: 8 }}>
                {translate('users.action.reset_password')}</Title>
              <Text type="secondary">{translate('auto.82abeffeba')}</Text>
            </div>

            {error && (
              <Alert message={error} type="error" showIcon closable style={{ marginBottom: 24 }} onClose={clearError} />
            )}

            <ResetPasswordForm loading={loading} onSubmit={submit} />

            <div style={{ textAlign: 'center' }}>
              <Space size={4}>
                <Text type="secondary">{translate('auto.3528487b49')}</Text>
                <Link to="/login">{translate('auth.login_now')}</Link>
              </Space>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default ResetPasswordPage
