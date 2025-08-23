import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Space } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone, CheckCircleOutlined } from '@ant-design/icons';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
// import { useTranslation } from 'react-i18next';
import { validateResetToken, resetPassword } from '../../lib/api';

const { Title, Text } = Typography;

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

const ResetPasswordPage: React.FC = () => {
  // const { t } = useTranslation();
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState(false);
  
  const token = searchParams.get('token');

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('重置链接无效或已过期');
        setValidating(false);
        return;
      }

      try {
        await validateResetToken(token);
        setTokenValid(true);
      } catch (err: any) {
        setError(err.response?.data?.message || '重置链接无效或已过期');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (values: ResetPasswordForm) => {
    if (!token) {
      setError('重置令牌无效');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword(token, values.password, values.confirmPassword);
      setSuccess(true);
      
      // 3秒后跳转到登录页
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || '密码重置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <Text>正在验证重置链接...</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleOutlined className="text-2xl text-green-600" />
            </div>
            
            <div className="space-y-2">
              <Title level={3} className="!mb-0">密码重置成功</Title>
              <Text type="secondary" className="block">
                您的密码已成功重置，即将跳转到登录页面...
              </Text>
            </div>
            
            <Link to="/login">
              <Button type="primary" size="large">
                立即登录
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <Title level={3} className="!mb-0">链接无效</Title>
              <Text type="secondary" className="block">
                {error || '重置链接无效或已过期，请重新申请密码重置。'}
              </Text>
            </div>
            
            <Space direction="vertical" className="w-full">
              <Link to="/forgot-password">
                <Button type="primary" size="large" className="w-full">
                  重新申请重置
                </Button>
              </Link>
              <Link to="/login">
                <Button type="default" size="large" className="w-full">
                  返回登录
                </Button>
              </Link>
            </Space>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <Title level={2} className="!mb-2">重置密码</Title>
          <Text type="secondary">
            请输入您的新密码
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
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' },
              {
                pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
                message: '密码必须包含字母和数字'
              }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码（至少6位，包含字母和数字）"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入新密码"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item className="mb-4">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-12 text-base font-medium"
            >
              {loading ? '重置中...' : '重置密码'}
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <div className="flex items-center justify-center space-x-1">
            <Text type="secondary">记起密码了？</Text>
            <Link to="/login">
              <Button type="link" className="p-0 h-auto">
                立即登录
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;