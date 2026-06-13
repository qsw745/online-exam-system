import React from 'react'
import { Card, Form, Input, Button, Alert, Typography, Space } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

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
            忘记密码
          </Title>
          <Text type="secondary">输入您的邮箱地址，我们将发送密码重置链接给您</Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} closable onClose={onCloseError} />
        )}

        <Form form={form} layout="vertical" onFinish={handleFinish} size="large">
          <Form.Item
            name="email"
            label="邮箱地址"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="请输入您的邮箱地址" autoComplete="email" disabled={loading} />
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
              {loading ? '发送中...' : '发送重置链接'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size={16}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Text type="secondary">记起密码了？</Text>
              <Link to="/login">
                <Button type="link" style={{ padding: 0, height: 'auto' }}>
                  立即登录
                </Button>
              </Link>
            </div>

            <Link to="/login">
              <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#8c8c8c' }}>
                返回登录页面
              </Button>
            </Link>
          </Space>
        </div>
      </Card>
    </div>
  )
}
