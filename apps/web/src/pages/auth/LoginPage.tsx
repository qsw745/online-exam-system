import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

import { Button, App, Card, Input, Checkbox, Space, Typography, Divider } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';

const { Title, Text, Link: AntLink } = Typography;

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  
  // 页面加载时，检查是否有保存的登录信息
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      message.error('请填写所有必需字段');
      return;
    }
    
    setLoading(true);
    
    try {
      await signIn(email, password, rememberMe);
      
      // 如果勾选了记住我，保存邮箱到本地存储
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('登录错误:', error);
      
      // 处理不同类型的错误
      let errorMessage = '登录失败';
      
      // 首先检查是否是从 api.ts 抛出的具体错误信息
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 401:
            errorMessage = '邮箱或密码错误，请检查后重试';
            break;
          case 403:
            errorMessage = '账号已被禁用，请联系管理员';
            break;
          case 429:
            errorMessage = '请求过于频繁，请稍后再试';
            break;
          default:
            errorMessage = data.message || '未知错误';
        }
      } else if (error.request) {
        errorMessage = '服务器无响应，请稍后重试';
      } else {
        errorMessage = '网络连接错误，请检查网络后重试';
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // 演示账号快速登录
  const quickLogin = (demoEmail: string, demoPassword: string = 'demo123456') => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 500,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Logo 和标题 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <BookOpen style={{ width: 32, height: 32, color: 'white' }} />
          </div>
          <Title level={2} style={{ marginBottom: 8 }}>登录您的账户</Title>
          <Text type="secondary">
            还没有账户？
            <Link to="/register" style={{ marginLeft: 4 }}>
              立即注册
            </Link>
          </Text>
        </div>
        
        {/* 演示账号 */}
        <Card 
          size="small" 
          style={{ 
            backgroundColor: '#f0f8ff', 
            border: '1px solid #d6e4ff',
            marginBottom: 24
          }}
        >
          <Title level={5} style={{ marginBottom: 12, color: '#1890ff' }}>演示账号快速登录</Title>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Button
              block
              size="small"
              onClick={() => quickLogin('admin@demo.com')}
              style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
            >
              <div>
                <Text strong style={{ color: '#1890ff' }}>管理员: </Text>
                <Text style={{ color: '#1890ff' }}>admin@demo.com</Text>
              </div>
            </Button>
            <Button
              block
              size="small"
              onClick={() => quickLogin('teacher@demo.com')}
              style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
            >
              <div>
                <Text strong style={{ color: '#1890ff' }}>教师: </Text>
                <Text style={{ color: '#1890ff' }}>teacher@demo.com</Text>
              </div>
            </Button>
            <Button
              block
              size="small"
              onClick={() => quickLogin('student@demo.com')}
              style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
            >
              <div>
                <Text strong style={{ color: '#1890ff' }}>学生: </Text>
                <Text style={{ color: '#1890ff' }}>student@demo.com</Text>
              </div>
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            所有演示账号密码都是：demo123456
          </Text>
        </Card>
        
        {/* 登录表单 */}
        <form onSubmit={handleSubmit}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* 邮箱 */}
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>邮箱地址</Text>
              <Input
                prefix={<UserOutlined />}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入您的邮箱"
                size="large"
                required
              />
            </div>
            
            {/* 密码 */}
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>密码</Text>
              <Input.Password
                prefix={<LockOutlined />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入您的密码"
                size="large"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                required
              />
            </div>
            
            {/* 记住我和忘记密码 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              >
                记住我
              </Checkbox>
              
              <Link to="/forgot-password">
                忘记密码？
              </Link>
            </div>
            
            {/* 登录按钮 */}
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              登录
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
