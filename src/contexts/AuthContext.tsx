import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, users } from '../lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (email: string, password: string, username: string, role: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 同时检查localStorage和sessionStorage中的token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      // 检查token是否过期
      try {
        const base64Url = token.split('.')[1];
        if (!base64Url) {
          throw new Error('Token格式不正确');
        }
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const payload = JSON.parse(jsonPayload);
        if (!payload || !payload.exp) {
          throw new Error('Token不包含过期时间');
        }
        
        const expirationTime = payload.exp * 1000; // 转换为毫秒
        
        if (Date.now() >= expirationTime) {
          // Token已过期，清除本地存储
          console.warn('Token已过期，需要重新登录');
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Token有效，获取用户信息
        users.getCurrentUser()
          .then(response => {
            const userData = response.data;
            // 确保用户角色信息被正确设置
            if (userData && userData.id) {
              // 如果用户数据中没有角色信息，但localStorage中有，则使用localStorage中的角色
              if (!userData.role && localStorage.getItem('userRole')) {
                userData.role = localStorage.getItem('userRole');
              }
              
              // 如果现在有角色信息，保存用户数据
              if (userData.role) {
                // 将用户角色保存到localStorage，以便在刷新页面时可以快速检查
                localStorage.setItem('userRole', userData.role);
                setUser(userData);
              } else {
                console.error('获取用户信息失败：缺少角色信息');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          localStorage.removeItem('userRole');
          sessionStorage.removeItem('userRole');
          setUser(null);
              }
            } else {
              console.error('获取用户信息失败：无效的用户数据');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          localStorage.removeItem('userRole');
          sessionStorage.removeItem('userRole');
          setUser(null);
            }
            setLoading(false);
          })
          .catch((error) => {
            console.error('获取用户信息错误:', error);
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          localStorage.removeItem('userRole');
          sessionStorage.removeItem('userRole');
          setUser(null);
            setLoading(false);
          });
      } catch (e) {
        console.error('解析token时出错:', e);
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('userRole');
      sessionStorage.removeItem('userRole');
      setUser(null);
        setLoading(false);
      }
    } else {
      localStorage.removeItem('userRole');
      sessionStorage.removeItem('userRole');
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await auth.login(email, password);
      if (response.data?.token && response.data?.user) {
        // 根据记住我选项决定存储位置
        if (rememberMe) {
          localStorage.setItem('token', response.data.token);
        } else {
          // 使用sessionStorage，这样浏览器关闭后会自动清除
          sessionStorage.setItem('token', response.data.token);
          localStorage.removeItem('token'); // 确保localStorage中没有token
        }
        
        // 确保用户角色信息存在
        const userData = response.data.user;
        if (!userData.role) {
          // 如果后端返回的用户数据中没有角色信息，尝试从localStorage获取
          const storedRole = localStorage.getItem('userRole');
          if (storedRole) {
            userData.role = storedRole;
          } else {
            console.warn('登录成功但用户角色信息缺失');
          }
        }
        
        // 保存用户角色到localStorage或sessionStorage
        if (userData.role) {
          if (rememberMe) {
            localStorage.setItem('userRole', userData.role);
          } else {
            sessionStorage.setItem('userRole', userData.role);
            localStorage.removeItem('userRole'); // 确保localStorage中没有userRole
          }
        }
        
        setUser(userData);
      } else {
        throw new Error('登录失败：未收到有效的认证令牌或用户信息');
      }
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, nickname: string, role: string) => {
    const response = await auth.register({ email, password, username: nickname, role });
    if (response.data?.token && response.data?.user) {
      // 注册成功后设置token和用户信息
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userRole', response.data.user.role || role);
      setUser(response.data.user);
    } else {
      throw new Error('注册失败：未收到有效的认证令牌或用户信息');
    }
  };

  const signOut = () => {
    auth.logout();
    // 清除用户角色信息
    localStorage.removeItem('userRole');
    setUser(null);
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
