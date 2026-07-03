import React from 'react'
import { Card, Form, Input, Button, Alert, Typography, Space } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

const { Title, Text } = Typography

type Props = {
  loading: boolean
  error: string | null
  onSubmit: (email: string) => void
  onCloseError: () => void
}

export const ForgotPasswordForm: React.FC<Props> = ({ loading, error, onSubmit, onCloseError }) => {
  const [form] = Form.useForm<{ email: string }>()

  const handleFinish = (values: { email: string }) => {
    onSubmit(values.email)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            {translate('auto.2e90a49062')}</Title>
          <Text type="secondary">{translate('auto.c667a197e0')}</Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} closable onClose={onCloseError} />
        )}

        <Form form={form} layout="vertical" onFinish={handleFinish} size="large">
          <Form.Item
            name="email"
            label={translate('auth.email_label')}
            rules={[
              { required: true, message: translate('auto.3f649d6040') },
              { type: 'email', message: translate('auto.25d22e5309') },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={translate('auto.3727cc779d')} autoComplete="email" disabled={loading} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 48, fontSize: 16, fontWeight: 500 }}
            >
              {loading ? translate('visible.6ed7650fb1') : translate('visible.99a9f47997')}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size={16}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Text type="secondary">{translate('auto.3528487b49')}</Text>
              <Link to="/login">
                <Button type="link" style={{ padding: 0, height: 'auto' }}>
                  {translate('auth.login_now')}</Button>
              </Link>
            </div>

            <Link to="/login">
              <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#8c8c8c' }}>
                {translate('auto.9ab306d6d4')}</Button>
            </Link>
          </Space>
        </div>
      </Card>
    </div>
  )
}
