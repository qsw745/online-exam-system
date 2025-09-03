import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Space, Spin } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone, CheckCircleOutlined } from '@ant-design/icons';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
// import { useTranslation } from 'react-i18next';
import { validateResetToken, resetPassword } from '@shared/api/http';

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
             <Space direction="vertical" size={16}>
               <Spin size="large" />
               <Text>正在验证重置链接...</Text>
             </Space>
           </div>
        </Card>
      </div>
    );
  }

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
                <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              </div>
              
              <div>
                <Title level={3} style={{ marginBottom: 8 }}>密码重置成功</Title>
                <Text type="secondary" style={{ display: 'block' }}>
                  您的密码已成功重置，即将跳转到登录页面...
                </Text>
              </div>
              
              <Link to="/login">
                <Button type="primary" size="large">
                  立即登录
                </Button>
              </Link>
            </Space>
          </div>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
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
              <div>
                <Title level={3} style={{ marginBottom: 8 }}>链接无效</Title>
                <Text type="secondary" style={{ display: 'block' }}>
                  {error || '重置链接无效或已过期，请重新申请密码重置。'}
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
          <Title level={2} style={{ marginBottom: 8 }}>重置密码</Title>
          <Text type="secondary">
            请输入您的新密码
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

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 48, fontSize: 16, fontWeight: 500 }}
            >
              {loading ? '重置中...' : '重置密码'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Text type="secondary">记起密码了？</Text>
            <Link to="/login">
              <Button type="link" style={{ padding: 0, height: 'auto' }}>
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