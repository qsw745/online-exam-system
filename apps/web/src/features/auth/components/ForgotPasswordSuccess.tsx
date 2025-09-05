import React from 'react'
import { Card, Typography, Space, Button } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

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
                邮件已发送
              </Title>
              <Text type="secondary" style={{ display: 'block' }}>
                我们已向您的邮箱发送了密码重置链接，请查收邮件并按照指示重置密码。
              </Text>
            </div>

            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 14, marginBottom: 12 }}>
                没有收到邮件？请检查垃圾邮件文件夹，或稍后重试。
              </Text>
              <Link to="/login">
                <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }}>
                  返回登录
                </Button>
              </Link>
            </div>
          </Space>
        </div>
      </Card>
    </div>
  )
}
