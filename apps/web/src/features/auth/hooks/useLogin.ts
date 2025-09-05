import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { useAuth } from '@shared/contexts/AuthContext'

const STORAGE_FLAG_KEY = 'auth_storage' // 与 http.ts 中保持一致：'local' | 'session'

function parseLoginError(err: any): string {
  if (err?.message) return err.message
  const status = err?.response?.status
  const dataMsg = err?.response?.data?.message
  if (status) {
    switch (status) {
      case 401:
        return '邮箱或密码错误，请检查后重试'
      case 403:
        return '账号已被禁用，请联系管理员'
      case 429:
        return '请求过于频繁，请稍后再试'
      default:
        return dataMsg || '未知错误'
    }
  }
  if (err?.request) return '服务器无响应，请稍后重试'
  return '网络连接错误，请检查网络后重试'
}

export function useLogin() {
  const { message } = App.useApp()
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)

  // 初始回填“记住的邮箱”
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const quickLogin = useCallback((demoEmail: string, demoPassword = 'demo123456') => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }, [])

  const submit = useCallback(async () => {
    if (!email || !password) {
      message.error('请填写所有必需字段')
      return
    }

    setLoading(true)
    try {
      await signIn(email, password, rememberMe)

      // 记住邮箱
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
        localStorage.setItem(STORAGE_FLAG_KEY, 'local') // 刷新 token 时优先写 localStorage
      } else {
        localStorage.removeItem('rememberedEmail')
        localStorage.setItem(STORAGE_FLAG_KEY, 'session') // 刷新 token 时优先写 sessionStorage
      }

      message.success('登录成功')
      navigate('/dashboard')
    } catch (err: any) {
      message.error(parseLoginError(err))
    } finally {
      setLoading(false)
    }
  }, [email, password, rememberMe, message, navigate, signIn])

  return {
    // 状态
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    loading,
    // 事件
    submit,
    quickLogin,
  }
}
