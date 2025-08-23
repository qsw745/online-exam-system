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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <MailOutlined className="text-2xl text-green-600" />
            </div>
            
            <div className="space-y-2">
              <Title level={3} className="!mb-0">邮件已发送</Title>
              <Text type="secondary" className="block">
                我们已向您的邮箱发送了密码重置链接，请查收邮件并按照指示重置密码。
              </Text>
            </div>
            
            <div className="space-y-3">
              <Text type="secondary" className="block text-sm">
                没有收到邮件？请检查垃圾邮件文件夹，或稍后重试。
              </Text>
              
              <Link to="/login">
                <Button type="link" icon={<ArrowLeftOutlined />} className="p-0">
                  返回登录
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <Title level={2} className="!mb-2">忘记密码</Title>
          <Text type="secondary">
            输入您的邮箱地址，我们将发送密码重置链接给您
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            className="mb-6"
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

          <Form.Item className="mb-4">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-12 text-base font-medium"
            >
              {loading ? '发送中...' : '发送重置链接'}
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-1">
            <Text type="secondary">记起密码了？</Text>
            <Link to="/login">
              <Button type="link" className="p-0 h-auto">
                立即登录
              </Button>
            </Link>
          </div>
          
          <Link to="/login">
            <Button type="text" icon={<ArrowLeftOutlined />} className="text-gray-500">
              返回登录页面
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;