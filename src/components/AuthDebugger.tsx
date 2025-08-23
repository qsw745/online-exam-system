import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/api';
import toast from 'react-hot-toast';

interface AuthDebuggerProps {
  onClose: () => void;
}

const AuthDebugger: React.FC<AuthDebuggerProps> = ({ onClose }) => {
  const { user, loading: authLoading, signIn } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
    
    let tokenInfo = null;
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const payload = JSON.parse(jsonPayload);
        const expirationTime = payload.exp * 1000;
        const isExpired = Date.now() >= expirationTime;
        
        tokenInfo = {
          payload,
          isExpired,
          expiresAt: new Date(expirationTime).toLocaleString()
        };
      } catch (e) {
        tokenInfo = { error: e.message };
      }
    }
    
    setDebugInfo({
      authLoading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      token: token ? 'exists' : 'missing',
      userRole,
      tokenInfo
    });
  }, [authLoading, user]);

  const handleClearAuth = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('userRole');
    sessionStorage.removeItem('userRole');
    localStorage.removeItem('rememberedEmail');
    toast.success('认证信息已清除');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleQuickLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signIn('admin@demo.com', 'demo123456', true);
      toast.success('登录成功');
      onClose();
    } catch (error: any) {
      toast.error(error.message || '登录失败');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">认证状态调试器</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-2">演示账号信息</h3>
            <div className="text-sm space-y-1">
              <div><strong>管理员：</strong> admin@demo.com / demo123456</div>
              <div><strong>教师：</strong> teacher@demo.com / demo123456</div>
              <div><strong>学生：</strong> student@demo.com / demo123456</div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">当前认证状态</h3>
            <pre className="text-sm bg-white p-2 rounded border overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleQuickLogin}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoggingIn ? '登录中...' : '快速登录(管理员)'}
            </button>
            
            <button
              onClick={handleClearAuth}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              清除认证信息
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              刷新页面
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            <p><strong>问题诊断：</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>如果 token 为 'missing'，需要重新登录</li>
              <li>如果 user 为 null，检查 token 是否过期</li>
              <li>如果 authLoading 为 true，等待认证完成</li>
              <li>如果 tokenInfo.isExpired 为 true，token 已过期需要重新登录</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthDebugger;