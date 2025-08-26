import React, { useState } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Space } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
// import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../../lib/api';

const { Title, Text } = Typography;

interface ForgotPasswordForm {
  email: string;
}

const ForgotPasswordPage: React.FC = () => {
  // const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: ForgotPasswordForm) => {
    setLoading(true);
    setError(null);
    
    try {
      await forgotPassword(values.email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || '发送重置邮件失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <Card style={{ 
          width: '100%', 
          maxWidth: 400,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <div style={{
                width: 64,
                height: 64,
                backgroundColor: '#f6ffed',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}>
                <MailOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              </div>
              
              <div>
                <Title level={3} style={{ marginBottom: 8 }}>邮件已发送</Title>
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
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Card style={{ 
        width: '100%', 
        maxWidth: 400,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>忘记密码</Title>
          <Text type="secondary">
            输入您的邮箱地址，我们将发送密码重置链接给您
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="email"
            label="邮箱地址"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入您的邮箱地址"
              autoComplete="email"
            />
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
  );
};

export default ForgotPasswordPage;