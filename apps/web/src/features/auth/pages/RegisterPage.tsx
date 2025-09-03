import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, BookOpen } from 'lucide-react';
import { useAuth } from '@shared/contexts/AuthContext';

import { Button, App, Card, Input, Checkbox, Space, Typography } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone, MailOutlined } from '@ant-design/icons';
import { useLanguage } from '@shared/contexts/LanguageContext';

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { message } = App.useApp();
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      message.error('请填写所有必需字段');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      message.error('密码与确认密码不一致');
      return;
    }
    
    if (formData.password.length < 6) {
      message.error('密码长度不能少于6位');
      return;
    }
    
    setLoading(true);
    
    try {
      await signUp(formData.email, formData.password, formData.nickname, 'student');
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      console.error('注册错误:', error);
      
      // 处理不同类型的错误
      let errorMessage = '注册失败';
      
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 409:
            errorMessage = '该邮箱已被注册，请直接登录或使用其他邮箱';
            break;
          case 400:
            if (data?.message?.includes('password')) {
              errorMessage = '密码长度至少需要6位字符';
            } else if (data?.message?.includes('email')) {
              errorMessage = '邮箱格式不正确，请重新输入';
            } else {
              errorMessage = data?.message || '请求参数错误';
            }
            break;
          case 403:
            errorMessage = '注册功能已禁用，请联系管理员';
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
          <Title level={2} style={{ marginBottom: 8 }}>创建新账户</Title>
          <Text type="secondary">
            已有账户？
            <Link to="/login" style={{ marginLeft: 4 }}>
              立即登录
            </Link>
          </Text>
        </div>
        
        {/* 注册表单 */}
        <form onSubmit={handleSubmit}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* 邮箱 */}
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>邮箱地址 *</Text>
              <Input
                prefix={<MailOutlined />}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="请输入您的邮箱"
                size="large"
                required
              />
            </div>
            
            {/* 昵称 */}
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>昵称</Text>
              <Input
                prefix={<UserOutlined />}
                name="nickname"
                type="text"
                value={formData.nickname}
                onChange={handleChange}
                placeholder="请输入您的昵称（可选）"
                size="large"
              />
            </div>
            
            {/* 密码 */}
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>密码 *</Text>
              <Input.Password
                prefix={<LockOutlined />}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('auth.password_placeholder')}
                size="large"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                required
              />
            </div>
            
            {/* 确认密码 */}
            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>{t('auth.confirm_password')} *</Text>
              <Input.Password
                prefix={<LockOutlined />}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={t('auth.confirm_password_placeholder')}
                size="large"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                required
              />
            </div>
            
            {/* 用户协议 */}
            <Checkbox required>
              <Text style={{ fontSize: 14 }}>
                {t('auth.agree_terms')}
                <a href="#" style={{ color: '#1890ff', margin: '0 4px' }}>{t('auth.terms')}</a>
                和
                <a href="#" style={{ color: '#1890ff', margin: '0 4px' }}>{t('auth.privacy')}</a>。
              </Text>
            </Checkbox>
            
            {/* 注册按钮 */}
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              创建账户
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

export default RegisterPage;
