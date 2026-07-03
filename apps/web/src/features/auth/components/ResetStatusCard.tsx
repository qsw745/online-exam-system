import React from 'react'
import { Alert, Button, Space, Spin, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

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
          <Text>{translate('auto.d1d7794556')}</Text>
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
              {translate('auto.5369b189fb')}</Title>
            <Text type="secondary" style={{ display: 'block' }}>
              {props.message || translate('visible.8f5e7324c7')}
            </Text>
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Link to="/forgot-password">
              <Button type="primary" size="large" block>
                {translate('auto.44dbce1816')}</Button>
            </Link>
            <Link to="/login">
              <Button type="default" size="large" block>
                {translate('auto.f2fe4ecc0f')}</Button>
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
            {translate('auto.f490870352')}</Title>
          <Text type="secondary" style={{ display: 'block' }}>
            {translate('auto.b1075dfdcc')}{typeof props.countdown === 'number' ? `（${props.countdown}s）` : ''}
            …
          </Text>
        </div>

        <Link to="/login">
          <Button type="primary" size="large">
            {translate('auth.login_now')}</Button>
        </Link>
      </Space>
    </div>
  )
}
