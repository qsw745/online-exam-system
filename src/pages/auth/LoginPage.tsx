import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  
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
      toast.error('请填写所有必需字段');
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
      
      toast.success('登录成功');
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
      
      toast.error(errorMessage);
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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo 和标题 */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">登录您的账户</h2>
          <p className="mt-2 text-sm text-gray-600">
            还没有账户？
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 ml-1">
              立即注册
            </Link>
          </p>
        </div>
        
        {/* 演示账号 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">演示账号快速登录</h3>
          <div className="space-y-2">
            <button
              onClick={() => quickLogin('admin@demo.com')}
              className="w-full text-left px-3 py-2 text-xs bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium text-blue-900">管理员:</span>
              <span className="text-blue-700 ml-2">admin@demo.com</span>
            </button>
            <button
              onClick={() => quickLogin('teacher@demo.com')}
              className="w-full text-left px-3 py-2 text-xs bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium text-blue-900">教师:</span>
              <span className="text-blue-700 ml-2">teacher@demo.com</span>
            </button>
            <button
              onClick={() => quickLogin('student@demo.com')}
              className="w-full text-left px-3 py-2 text-xs bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium text-blue-900">学生:</span>
              <span className="text-blue-700 ml-2">student@demo.com</span>
            </button>
          </div>
          <p className="text-xs text-blue-600 mt-2">所有演示账号密码都是：demo123456</p>
        </div>
        
        {/* 登录表单 */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                邮箱地址
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="请输入您的邮箱"
                  required
                />
              </div>
            </div>
            
            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="请输入您的密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* 记住我 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                记住我
              </label>
            </div>
            
            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                忘记密码？
              </Link>
            </div>
          </div>
          
          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all duration-200',
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105'
            )}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
