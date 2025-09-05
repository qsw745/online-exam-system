import React from 'react'
import { Card, Button, Typography, Space } from 'antd'

const { Title, Text } = Typography

type Props = {
  onQuickLogin: (email: string, pwd?: string) => void
}

export const DemoAccountsCard: React.FC<Props> = ({ onQuickLogin }) => {
  return (
    <Card size="small" style={{ backgroundColor: '#f0f8ff', border: '1px solid #d6e4ff', marginBottom: 24 }}>
      <Title level={5} style={{ marginBottom: 12, color: '#1890ff' }}>
        演示账号快速登录
      </Title>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button
          block
          size="small"
          onClick={() => onQuickLogin('admin@demo.com')}
          style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
        >
          <div>
            <Text strong style={{ color: '#1890ff' }}>
              管理员:{' '}
            </Text>
            <Text style={{ color: '#1890ff' }}>admin@demo.com</Text>
          </div>
        </Button>
        <Button
          block
          size="small"
          onClick={() => onQuickLogin('teacher@demo.com')}
          style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
        >
          <div>
            <Text strong style={{ color: '#1890ff' }}>
              教师:{' '}
            </Text>
            <Text style={{ color: '#1890ff' }}>teacher@demo.com</Text>
          </div>
        </Button>
        <Button
          block
          size="small"
          onClick={() => onQuickLogin('student@demo.com')}
          style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
        >
          <div>
            <Text strong style={{ color: '#1890ff' }}>
              学生:{' '}
            </Text>
            <Text style={{ color: '#1890ff' }}>student@demo.com</Text>
          </div>
        </Button>
      </Space>
      <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
        所有演示账号密码都是：demo123456
      </Text>
    </Card>
  )
}
