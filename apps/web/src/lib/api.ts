// api.ts — 直接替换你的文件

import axios, { AxiosError, AxiosHeaders, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

/** 标准化返回类型 */
export type ApiSuccess<T = any> = {
  success: true
  data: T
  total?: number
  page?: number
  limit?: number
}
export type ApiFailure = {
  success: false
  error: string
}
export type ApiResult<T = any> = ApiSuccess<T> | ApiFailure

// baseURL：开发走相对路径/生产走 .env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const baseURL = import.meta.env.DEV ? '/api' : API_URL

/** 底层 axios 实例（只负责发请求与拦截，不直接给业务用） */
const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
})

/** 请求拦截：附加 Bearer Token（含过期检测与跳转） */
http.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (token) {
      try {
        const base64Url = token.split('.')[1]
        if (!base64Url) throw new Error('Token 格式不正确')
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
        const payload = JSON.parse(jsonPayload)
        if (!payload?.exp) throw new Error('Token 不包含过期时间')
        if (Date.now() >= payload.exp * 1000) {
          // 过期：清理并跳登录
          localStorage.removeItem('token')
          sessionStorage.removeItem('token')
          localStorage.removeItem('userRole')
          sessionStorage.removeItem('userRole')
          if (window.location.pathname !== '/login') window.location.href = '/login'
          return config
        }
      } catch (e) {
        // 解析异常：清理并跳登录
        localStorage.removeItem('token')
        sessionStorage.removeItem('token')
        localStorage.removeItem('userRole')
        sessionStorage.removeItem('userRole')
        if (window.location.pathname !== '/login') window.location.href = '/login'
        return config
      }
      if (!config.headers) {
        config.headers = new AxiosHeaders()
      }
      ;(config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`)
    }
    return config
  },
  error => Promise.reject(error)
)

/** 响应错误（主要 401）只在这里做“副作用”，不改返回结构 */
http.interceptors.response.use(
  resp => resp,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
      localStorage.removeItem('userRole')
      sessionStorage.removeItem('userRole')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

/** 统一“标准化响应”的封装器 */
async function normalize<T = any>(promise: Promise<AxiosResponse<any>>): Promise<ApiResult<T>> {
  try {
    const response = await promise

    // 如果后端已为统一格式 { success, data, message/error, total/page/limit }
    if (response.data && typeof response.data.success !== 'undefined') {
      if (!response.data.success) {
        return { success: false, error: response.data.message || response.data.error || '请求失败' }
      }
      const result: ApiSuccess<T> = {
        success: true,
        data: (response.data.data ?? {}) as T,
      }
      if (response.data.total !== undefined) result.total = response.data.total
      if (response.data.page !== undefined) result.page = response.data.page
      if (response.data.limit !== undefined) result.limit = response.data.limit

      // /users/me 特殊处理：补 role
      const url = response.config.url || ''
      if (url.includes('/users/me') && result.data && typeof result.data === 'object') {
        const role = localStorage.getItem('userRole')
        if (role && !(result.data as any).role) (result.data as any).role = role
      }
      return result
    }

    // 否则包装成标准格式
    return { success: true, data: (response.data ?? {}) as T }
  } catch (err: any) {
    if (err?.response) {
      const msg = err.response.data?.message || err.response.data?.error || '请求失败'
      return { success: false, error: msg }
    }
    if (err?.request) return { success: false, error: '服务器无响应，请检查网络连接' }
    return { success: false, error: '请求配置错误，请稍后重试' }
  }
}

/** 对外导出的“业务友好型” API：返回 ApiResult<T> */
type Params = Record<string, any>
export const api = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return normalize<T>(http.get(url, config))
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return normalize<T>(http.post(url, data, config))
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return normalize<T>(http.put(url, data, config))
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    return normalize<T>(http.delete(url, config))
  },
}

// 下面这些具体 API 保持你的调用方式（返回 ApiResult<T>）
export const auth = {
  async login(email: string, password: string) {
    return api.post<{ token: string }>('/auth/login', { email, password })
  },
  async register(userData: { email: string; password: string; username: string; role: string }) {
    return api.post('/auth/register', userData)
  },
  logout() {
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
    localStorage.removeItem('userRole')
    sessionStorage.removeItem('userRole')
  },
  async forgotPassword(email: string) {
    return api.post('/password-reset/forgot-password', { email })
  },
  async validateResetToken(token: string) {
    return api.get(`/password-reset/validate-token/${token}`)
  },
  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return api.post('/password-reset/reset-password', { token, newPassword, confirmPassword })
  },
}
export const { login, register, logout, forgotPassword, validateResetToken, resetPassword } = auth

export const users = {
  getCurrentUser: () => api.get('/users/me'),
  updateProfile: (userData: any) => api.put('/users/me', userData),
  getAll: (params: { page: number; limit: number; search?: string; role?: string }) => api.get('/users', { params }),
  getById: (id: number) => api.get(`/users/${id}`),
  update: (id: string, userData: any) => api.put(`/users/${id}`, userData),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateStatus: (id: string, status: 'active' | 'disabled') => api.put(`/users/${id}/status`, { status }),
  resetPassword: (id: string) => api.put(`/users/${id}/reset-password`),
}

export const exams = {
  getAll: () => api.get('/exams'),
  getById: (id: string) => api.get(`/exams/${id}`),
  create: (examData: any) => api.post('/exams', examData),
  update: (id: string, examData: any) => api.put(`/exams/${id}`, examData),
  delete: (id: string) => api.delete(`/exams/${id}`),
  submit: (taskId: string, submitData: any) => api.post(`/tasks/${taskId}/submit`, submitData),
}

export const questions = {
  getAll: (params?: { page?: number; limit?: number; search?: string; type?: string }) =>
    api.get('/questions', { params }),
  list: (params?: { type?: string; difficulty?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/questions', { params }),
  getById: (id: string) => api.get(`/questions/${id}`),
  create: (questionData: any) => api.post('/questions', questionData),
  update: (id: string, questionData: any) => api.put(`/questions/${id}`, questionData),
  delete: (id: string) => api.delete(`/questions/${id}`),
  bulkImport: (data: any[]) => api.post('/questions/bulk-import', { questions: data }),
}

export const tasks = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: string }) =>
    api.get('/tasks', { params }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (taskData: any) => api.post('/tasks', taskData),
  update: (id: string, taskData: any) => api.put(`/tasks/${id}`, taskData),
  delete: (id: string) => api.delete(`/tasks/${id}`),
}

export const notifications = {
  list: () => api.get('/notifications'),
  unreadCount: async () => {
    const res = await api.get<{ unreadCount: number }>('/notifications/unread-count')
    return res.success ? res : { success: true, data: { unreadCount: 0 } }
  },
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
}

export const results = {
  list: (params?: { limit?: number; sort?: string }) => api.get('/exam_results', { params }),
  getById: (id: string) => api.get(`/exam_results/${id}`),
}

export const dashboard = {
  getStats: () =>
    api
      .get('/dashboard/stats')
      .then(res =>
        res.success
          ? res
          : { success: true, data: { total_tasks: 0, completed_tasks: 0, average_score: 0, best_score: 0 } }
      ),
}

export const favorites = {
  list: () => api.get('/favorites').then(r => (r.success ? r : { success: true, data: { favorites: [] } })),
  add: (qid: string) => api.post('/favorites', { question_id: qid }),
  remove: (qid: string) => api.delete(`/favorites/${qid}`),
}

export const papers = {
  list: (params?: { difficulty?: string; limit?: number; offset?: number }) => api.get('/papers', { params }),
  getById: (id: string) => api.get(`/papers/${id}`),
  create: (paperData: any) => api.post('/papers', paperData),
  update: (id: string, paperData: any) => api.put(`/papers/${id}`, paperData),
  delete: (id: string) => api.delete(`/papers/${id}`),
  getQuestions: (id: string) => api.get(`/papers/${id}/questions`),
  addQuestion: (paperId: string, data: any) => api.post(`/papers/${paperId}/questions`, data),
  removeQuestion: (paperId: string, qid: string) => api.delete(`/papers/${paperId}/questions/${qid}`),
  updateQuestionOrder: (paperId: string, orderData: any) => api.put(`/papers/${paperId}/questions/order`, orderData),
}

export const profile = {
  update: (profileData: any) => api.put('/users/me', profileData),
  uploadAvatar: (formData: FormData) =>
    api.post('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export const wrongQuestions = {
  recordPractice: (d: { question_id: number; is_correct: boolean; answer: any }) => api.post('/questions/practice', d),
  getPracticedQuestions: () => api.get('/questions/practiced-questions'),
  getWrongQuestions: (params?: { page?: number; limit?: number; mastered?: boolean }) =>
    api.get('/questions/wrong-questions', { params }),
  markAsMastered: (id: number) => api.put(`/questions/wrong-questions/${id}/mastered`),
  removeFromWrongQuestions: (id: number) => api.delete(`/questions/wrong-questions/${id}`),
  getPracticeStats: () => api.get('/questions/practice-stats'),
}

export const settings = {
  async get() {
    const token = localStorage.getItem('token')
    if (!token) {
      // 未登录：读本地
      const base = {
        notifications: { email: true, push: true, sound: true },
        privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
        appearance: { language: (localStorage.getItem('language') as string) || 'zh-CN' },
      }
      const stored = localStorage.getItem('userSettings')
      if (stored) {
        try {
          const p = JSON.parse(stored)
          return {
            success: true,
            data: {
              notifications: { ...base.notifications, ...p.notifications },
              privacy: { ...base.privacy, ...p.privacy },
              appearance: { ...base.appearance, ...p.appearance },
            },
          } as ApiSuccess
        } catch {}
      }
      return { success: true, data: base } as ApiSuccess
    }
    const res = await api.get('/users/settings')
    if (res.success && res.data) localStorage.setItem('userSettings', JSON.stringify(res.data))
    return res
  },

  async save(settingsData: any) {
    localStorage.setItem('userSettings', JSON.stringify(settingsData))
    const token = localStorage.getItem('token')
    if (!token) {
      if (settingsData?.appearance?.language) localStorage.setItem('language', settingsData.appearance.language)
      return { success: true, data: settingsData } as ApiSuccess
    }
    const res = await api.post('/users/settings', settingsData)
    return res.success ? res : { success: true, data: settingsData }
  },
}
