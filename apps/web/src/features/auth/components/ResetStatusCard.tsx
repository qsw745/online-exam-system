import React from 'react'
import { Alert, Button, Space, Spin, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Title, Text } = Typography

type Props =
  | { variant: 'validating' }
  | { variant: 'invalid'; message?: string }
  | { variant: 'success'; countdown?: number }

export const ResetStatusCard: React.FC<Props> = props => {
  if (props.variant === 'validating') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Space direction="vertical" size={16}>
          <Spin size="large" />
          <Text>正在验证重置链接…</Text>
        </Space>
      </div>
    )
  }

  if (props.variant === 'invalid') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>
              链接无效
            </Title>
            <Text type="secondary" style={{ display: 'block' }}>
              {props.message || '重置链接无效或已过期，请重新申请密码重置。'}
            </Text>
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Link to="/forgot-password">
              <Button type="primary" size="large" block>
                重新申请重置
              </Button>
            </Link>
            <Link to="/login">
              <Button type="default" size="large" block>
                返回登录
              </Button>
            </Link>
          </Space>
        </Space>
      </div>
    )
  }

  // success
  return (
    <div style={{ textAlign: 'center' }}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div
          style={{
            width: 64,
            height: 64,
            backgroundColor: '#f6ffed',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
        </div>

        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            密码重置成功
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            您的密码已成功重置，即将跳转到登录页面{typeof props.countdown === 'number' ? `（${props.countdown}s）` : ''}
            …
          </Text>
        </div>

        <Link to="/login">
          <Button type="primary" size="large">
            立即登录
          </Button>
        </Link>
      </Space>
    </div>
  )
}
