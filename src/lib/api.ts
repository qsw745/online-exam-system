import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// 开发环境下，使用相对路径
const baseURL = import.meta.env.DEV ? '/api' : API_URL;

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

// 请求拦截器：添加 token
api.interceptors.request.use(
  (config) => {
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
          // Token已过期，清除本地存储并重定向到登录页
          console.warn('Token已过期，需要重新登录');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          localStorage.removeItem('userRole');
          sessionStorage.removeItem('userRole');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return config;
        }
      } catch (e) {
        console.error('解析token时出错:', e);
        // 如果解析token出错，清除token并重定向到登录页
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        localStorage.removeItem('userRole');
        sessionStorage.removeItem('userRole');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return config;
      }
      
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => {
    // 如果响应数据是标准格式（包含 success 字段），处理并返回
    if (response.data && typeof response.data.success !== 'undefined') {
      if (!response.data.success) {
        // 如果请求不成功，将错误信息包装到错误对象中
        const error = new Error(response.data.message || response.data.error || '请求失败');
        error.response = response;
        return Promise.reject(error);
      }
      // 确保 data 字段存在，如果不存在则提供空对象
      const responseData = response.data.data || {};
      
      // 特殊处理 /users/me 接口的响应，确保用户角色信息存在
      if (response.config.url?.includes('/users/me') && responseData) {
        // 如果用户数据中没有角色信息，尝试从 localStorage 获取
        if (!responseData.role && localStorage.getItem('userRole')) {
          responseData.role = localStorage.getItem('userRole');
        }
      }
      
      return {
        success: true,
        data: responseData
      };
    }
    // 否则包装成标准格式
    return {
      success: true,
      data: response.data || {}
    };
  },
  (error) => {
    // 检查是否是401认证错误
    if (error.response?.status === 401) {
      // 清除本地存储的认证信息
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('userRole');
      sessionStorage.removeItem('userRole');
      
      // 如果不在登录页面，重定向到登录页面
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      const errorMessage = data.error || data.message || '未知错误';
      
      switch (status) {
        case 401:
          // 未授权错误已在上面处理
          break;
        case 403:
          // 权限不足
          console.error('权限不足:', errorMessage);
          break;
        default:
          console.error('请求错误:', errorMessage);
      }
      
      // 包装错误信息
      const enhancedError = new Error(errorMessage);
      enhancedError.response = error.response;
      return Promise.reject(enhancedError);
    } else if (error.request) {
      // 请求发出但未收到响应
      console.error('服务器无响应');
      return Promise.reject(new Error('服务器无响应，请检查网络连接'));
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message);
      return Promise.reject(new Error('请求配置错误，请稍后重试'));
    }
  }
);

// 认证相关 API
export const auth = {
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.success && response.data?.token) {
        return response;
      } else {
        throw new Error('登录失败：未收到有效的认证令牌');
      }
    } catch (error: any) {
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 401:
            throw new Error('邮箱或密码错误');
          case 403:
            throw new Error('账号已被禁用');
          case 429:
            throw new Error('请求过于频繁，请稍后再试');
          default:
            throw new Error(data.message || '登录失败，请稍后重试');
        }
      } else if (error.request) {
        throw new Error('服务器无响应，请检查网络连接');
      } else {
        throw new Error('请求失败，请稍后重试');
      }
    }
  },

  register: async (userData: { email: string; password: string; username: string; role: string }) => {
    const response = await api.post('/auth/register', userData);
    return response;
  },

  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('userRole');
    sessionStorage.removeItem('userRole');
  },

  forgotPassword: async (email: string) => {
    try {
      const response = await api.post('/password-reset/forgot-password', { email });
      return response;
    } catch (error: any) {
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 404:
            throw new Error('该邮箱地址未注册');
          case 429:
            throw new Error('请求过于频繁，请稍后再试');
          default:
            throw new Error(data.error || data.message || '发送重置邮件失败，请稍后重试');
        }
      } else if (error.request) {
        throw new Error('服务器无响应，请检查网络连接');
      } else {
        throw new Error('请求失败，请稍后重试');
      }
    }
  },

  validateResetToken: async (token: string) => {
    try {
      const response = await api.get(`/password-reset/validate-token/${token}`);
      return response;
    } catch (error: any) {
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 400:
            throw new Error('重置链接无效');
          case 410:
            throw new Error('重置链接已过期');
          default:
            throw new Error(data.error || data.message || '验证失败');
        }
      } else {
        throw new Error('验证失败，请稍后重试');
      }
    }
  },

  resetPassword: async (token: string, newPassword: string, confirmPassword: string) => {
    try {
      const response = await api.post('/password-reset/reset-password', { token, newPassword, confirmPassword });
      return response;
    } catch (error: any) {
      if (error.response) {
        const { status, data } = error.response;
        switch (status) {
          case 400:
            throw new Error('重置链接无效或密码格式不正确');
          case 410:
            throw new Error('重置链接已过期');
          default:
            throw new Error(data.error || data.message || '密码重置失败，请稍后重试');
        }
      } else {
        throw new Error('密码重置失败，请稍后重试');
      }
    }
  },
};

// 导出独立的认证API函数
export const { login, register, logout, forgotPassword, validateResetToken, resetPassword } = auth;

// 用户相关 API
export const users = {
  getCurrentUser: async () => {
    return await api.get('/users/me');
  },

  updateProfile: async (userData: any) => {
    return await api.put('/users/me', userData);
  },

  getAll: async (params: { page: number; limit: number; search?: string; role?: string }) => {
    return await api.get('/users', { params });
  },

  getById: async (id: number) => {
    return await api.get(`/users/${id}`);
  },

  update: async (id: string, userData: any) => {
    return await api.put(`/users/${id}`, userData);
  },

  delete: async (id: string) => {
    return await api.delete(`/users/${id}`);
  },
};

// 用户设置相关API已在文件后面定义

// 考试相关 API
export const exams = {
  getAll: async () => {
    return await api.get('/exams');
  },

  getById: async (id: string) => {
    return await api.get(`/exams/${id}`);
  },

  create: async (examData: any) => {
    return await api.post('/exams', examData);
  },

  update: async (id: string, examData: any) => {
    return await api.put(`/exams/${id}`, examData);
  },

  delete: async (id: string) => {
    return await api.delete(`/exams/${id}`);
  },

  submit: async (taskId: string, submitData: any) => {
    return await api.post(`/tasks/${taskId}/submit`, submitData);
  },
};

// 试题相关 API
export const questions = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; type?: string }) => {
    return await api.get('/questions', { params });
  },

list: async (params?: {
  type?: string;
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const res = await api.get('/questions', { params }); // res 形如 { success: true, data: {...} }
    // 这里不需要再检查 res.data.success，拦截器已在 success=false 时直接 reject 了
    return res; // 保持 { success, data } 的统一结构
  } catch (error: any) {
    // 401 统一转成 AUTHENTICATION_REQUIRED，供页面处理
    if (error.response?.status === 401) {
      throw new Error('AUTHENTICATION_REQUIRED');
    }
    throw error;
  }
},


  getById: async (id: string) => {
    return await api.get(`/questions/${id}`);
  },

  create: async (questionData: any) => {
    return await api.post('/questions', questionData);
  },

  update: async (id: string, questionData: any) => {
    return await api.put(`/questions/${id}`, questionData);
  },

  delete: async (id: string) => {
    return await api.delete(`/questions/${id}`);
  },

  bulkImport: async (data: any[]) => {
    return await api.post('/questions/bulk-import', { questions: data });
  },
};

// 任务相关 API
export const tasks = {
  list: async (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: string }) => {
    return await api.get('/tasks', { params });
  },

  getById: async (id: string) => {
    return await api.get(`/tasks/${id}`);
  },

  create: async (taskData: any) => {
    return await api.post('/tasks', taskData);
  },

  update: async (id: string, taskData: any) => {
    return await api.put(`/tasks/${id}`, taskData);
  },

  delete: async (id: string) => {
    return await api.delete(`/tasks/${id}`);
  },
};

// 通知相关 API
export const notifications = {
  list: async () => {
    const response = await api.get('/notifications');
    if (!response.success || !response.data) {
      throw new Error(response.error || '获取通知列表失败');
    }
    return response;
  },

  unreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    if (!response.success) {
      throw new Error(response.error || '获取未读通知数量失败');
    }
    return {
      success: true,
      data: {
        unreadCount: response.data?.unreadCount || 0
      }
    };
  },

  markAsRead: async (notificationId: string) => {
    return await api.put(`/notifications/${notificationId}/read`);
  }
};

// 考试结果相关 API
export const results = {
  list: async (params?: { limit?: number; sort?: string }) => {
    const response = await api.get('/exam_results', { params });
    if (!response.success) {
      throw new Error(response.error || '获取成绩列表失败');
    }
    return {
      success: true,
      data: {
        results: response.data?.results || []
      }
    };
  },

  getById: async (id: string) => {
    return await api.get(`/exam_results/${id}`);
  }
};

// 仪表盘相关 API
export const dashboard = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    if (!response.success) {
      throw new Error(response.error || '获取统计数据失败');
    }
    return {
      success: true,
      data: response.data || {
        total_tasks: 0,
        completed_tasks: 0,
        average_score: 0,
        best_score: 0
      }
    };
  }
};

// 收藏相关 API
export const favorites = {
  list: async () => {
    const response = await api.get('/favorites');
    if (!response.success) {
      throw new Error(response.error || '获取收藏列表失败');
    }
    return {
      success: true,
      data: {
        favorites: response.data?.favorites || []
      }
    };
  },

  add: async (questionId: string) => {
    return await api.post('/favorites', { question_id: questionId });
  },

  remove: async (questionId: string) => {
    return await api.delete(`/favorites/${questionId}`);
  }
};

// 试卷相关 API
export const papers = {
  list: async (params?: { difficulty?: string; limit?: number; offset?: number }) => {
    try {
      const response = await api.get('/papers', { params });
      if (!response.success) {
        throw new Error(response.error || '获取试卷列表失败');
      }
      return {
        success: true,
        data: {
          papers: response.data?.papers || []
        }
      };
    } catch (error) {
      console.error('获取试卷列表错误:', error);
      // 返回空数组，避免 undefined 错误
      return {
        success: false,
        data: {
          papers: []
        },
        error: error instanceof Error ? error.message : '获取试卷列表失败'
      };
    }
  },

  getById: async (id: string) => {
    return await api.get(`/papers/${id}`);
  },

  create: async (paperData: any) => {
    return await api.post('/papers', paperData);
  },

  update: async (id: string, paperData: any) => {
    return await api.put(`/papers/${id}`, paperData);
  },

  delete: async (id: string) => {
    return await api.delete(`/papers/${id}`);
  },

  getQuestions: async (id: string) => {
    try {
      console.log('获取试卷题目，paperId:', id);
      console.log('当前认证令牌:', localStorage.getItem('token') ? '已存在' : '不存在');
      const response = await api.get(`/papers/${id}/questions`);
      console.log('获取试卷题目响应:', response);
      return response;
    } catch (error) {
      console.error('获取试卷题目错误:', error);
      throw error;
    }
  },

  addQuestion: async (paperId: string, questionData: any) => {
    return await api.post(`/papers/${paperId}/questions`, questionData);
  },

  removeQuestion: async (paperId: string, questionId: string) => {
    return await api.delete(`/papers/${paperId}/questions/${questionId}`);
  },

  updateQuestionOrder: async (paperId: string, orderData: any) => {
    return await api.put(`/papers/${paperId}/questions/order`, orderData);
  }
};

// 个人资料相关 API
export const profile = {
  update: async (profileData: any) => {
    return await api.put('/users/me', profileData);
  },

  uploadAvatar: async (formData: FormData) => {
     return await api.post('/users/me/avatar', formData, {
       headers: {
         'Content-Type': 'multipart/form-data'
       }
     });
   },
 };
 
 // 错题本相关API
 export const wrongQuestions = {
   recordPractice: async (practiceData: { question_id: number; is_correct: boolean; answer: any }) => {
     return await api.post('/questions/practice', practiceData);
   },
 
   getPracticedQuestions: async () => {
     return await api.get('/questions/practiced-questions');
   },
 
   getWrongQuestions: async (params?: { page?: number; limit?: number; mastered?: boolean }) => {
     return await api.get('/questions/wrong-questions', { params });
   },
 
   markAsMastered: async (questionId: number) => {
     return await api.put(`/questions/wrong-questions/${questionId}/mastered`);
   },
 
   removeFromWrongQuestions: async (questionId: number) => {
     return await api.delete(`/questions/wrong-questions/${questionId}`);
   },
 
   getPracticeStats: async () => {
     return await api.get('/questions/practice-stats');
   }
 };

// 设置相关 API
export const settings = {
  get: async () => {
    // 检查用户是否已登录
    const token = localStorage.getItem('token');
    if (!token) {
      // 未登录时返回本地存储的设置或默认设置
      const storedSettings = localStorage.getItem('userSettings');
      let localSettings = {
        notifications: {
          email: true,
          push: true,
          sound: true
        },
        privacy: {
          profile_visibility: 'public',
          show_activity: true,
          show_results: true
        },
        appearance: {
          language: localStorage.getItem('language') as string || 'zh-CN'
        }
      };
      
      // 如果本地有存储的设置，使用本地存储的设置
      if (storedSettings) {
        try {
          const parsedSettings = JSON.parse(storedSettings);
          // 正确合并嵌套对象
          localSettings = {
            notifications: {
              ...localSettings.notifications,
              ...parsedSettings.notifications
            },
            privacy: {
              ...localSettings.privacy,
              ...parsedSettings.privacy
            },
            appearance: {
              ...localSettings.appearance,
              ...parsedSettings.appearance
            }
          };
        } catch (e) {
          console.error('解析本地设置失败:', e);
        }
      }
      
      return {
        success: true,
        data: localSettings
      };
    }
    
    try {
      const response = await api.get('/users/settings');
      // 同时保存到本地存储，以便未登录时使用
      if (response.data) {
        localStorage.setItem('userSettings', JSON.stringify(response.data));
      }
      return {
        success: true,
        data: response.data || {
          notifications: {
            email: true,
            push: true,
            sound: true
          },
          privacy: {
            profile_visibility: 'public',
            show_activity: true,
            show_results: true
          },
          appearance: {
            language: 'zh-CN'
          }
        }
      };
    } catch (error) {
      console.error('获取设置失败:', error);
      // 尝试从本地存储获取设置
      const storedSettings = localStorage.getItem('userSettings');
      let localSettings = {
        notifications: {
          email: true,
          push: true,
          sound: true
        },
        privacy: {
          profile_visibility: 'public',
          show_activity: true,
          show_results: true
        },
        appearance: {
          language: localStorage.getItem('language') as string || 'zh-CN'
        }
      };
      
      if (storedSettings) {
        try {
          const parsedSettings = JSON.parse(storedSettings);
          // 正确合并嵌套对象
          localSettings = {
            notifications: {
              ...localSettings.notifications,
              ...parsedSettings.notifications
            },
            privacy: {
              ...localSettings.privacy,
              ...parsedSettings.privacy
            },
            appearance: {
              ...localSettings.appearance,
              ...parsedSettings.appearance
            }
          };
        } catch (e) {
          console.error('解析本地设置失败:', e);
        }
      }
      
      return {
        success: true,
        data: localSettings
      };
    }
  },

  save: async (settingsData: any) => {
    // 检查用户是否已登录
    const token = localStorage.getItem('token');
    // 始终保存到本地存储
    localStorage.setItem('userSettings', JSON.stringify(settingsData));
    
    if (!token) {
      // 未登录时只保存语言设置到本地存储
      if (settingsData?.appearance?.language) {
        localStorage.setItem('language', settingsData.appearance.language);
      }
      return {
        success: true,
        data: settingsData
      };
    }
    
    try {
      // 调用后端API保存设置
      const response = await api.post('/users/settings', settingsData);
      return {
        success: true,
        data: response.data || settingsData
      };
    } catch (error) {
      console.error('保存设置失败:', error);
      throw new Error('保存设置失败');
    }
  }
};