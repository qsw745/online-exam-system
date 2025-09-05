import React from 'react'
import { Card, Alert, Typography, Space } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { ResetStatusCard } from '../../auth/components/ResetStatusCard'
import { ResetPasswordForm } from '../../auth/components/ResetPasswordForm'
import { useResetPassword } from '../../auth/hooks/useResetPassword'

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
  const token = sp.get('token')
  const { status, error, loading, submit, countdown, clearError } = useResetPassword(token)

  return (
    <div style={shellStyle}>
      <Card style={cardStyle}>
        {/* 三种“非表单”状态：校验中 / 无效 / 成功 */}
        {status === 'validating' && <ResetStatusCard variant="validating" />}
        {status === 'invalid' && <ResetStatusCard variant="invalid" message={error || undefined} />}
        {status === 'success' && <ResetStatusCard variant="success" countdown={countdown} />}

        {/* 表单状态 */}
        {status === 'form' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <Title level={2} style={{ marginBottom: 8 }}>
                重置密码
              </Title>
              <Text type="secondary">请输入您的新密码</Text>
            </div>

            {error && (
              <Alert message={error} type="error" showIcon closable style={{ marginBottom: 24 }} onClose={clearError} />
            )}

            <ResetPasswordForm loading={loading} onSubmit={submit} />

            <div style={{ textAlign: 'center' }}>
              <Space size={4}>
                <Text type="secondary">记起密码了？</Text>
                <Link to="/login">立即登录</Link>
              </Space>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default ResetPasswordPage
