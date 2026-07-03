import React from 'react'
import { Card, Typography, Space, Button } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

const { Title, Text } = Typography

export const ForgotPasswordSuccess: React.FC = () => {
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
              <MailOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            </div>

            <div>
              <Title level={3} style={{ marginBottom: 8 }}>
                {translate('auto.c29ab1346a')}</Title>
              <Text type="secondary" style={{ display: 'block' }}>
                {translate('auto.71a52f22da')}</Text>
            </div>

            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 14, marginBottom: 12 }}>
                {translate('auto.d1320f58c5')}</Text>
              <Link to="/login">
                <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }}>
                  {translate('auto.f2fe4ecc0f')}</Button>
              </Link>
            </div>
          </Space>
        </div>
      </Card>
    </div>
  )
}
