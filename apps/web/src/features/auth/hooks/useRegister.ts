import { App } from 'antd'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/AuthContext'

export type RegisterValues = {
  email: string
  password: string
  confirmPassword: string
  nickname?: string
  agree: boolean
}

function parseRegisterError(err: any): string {
  if (err?.message) return err.message
  const status = err?.response?.status
  const dataMsg = err?.response?.data?.message
  if (status) {
    switch (status) {
      case 409:
        return '该邮箱已被注册，请直接登录或使用其他邮箱'
      case 400:
        if (dataMsg?.includes?.('password')) return '密码长度至少需要6位字符'
        if (dataMsg?.includes?.('email')) return '邮箱格式不正确，请重新输入'
        return dataMsg || '请求参数错误'
      case 403:
        return '注册功能已禁用，请联系管理员'
      case 429:
        return '请求过于频繁，请稍后再试'
      default:
        return dataMsg || '未知错误'
    }
  }
  if (err?.request) return '服务器无响应，请稍后重试'
  return '网络连接错误，请检查网络后重试'
}

export function useRegister(defaultRole: 'student' | 'teacher' | 'admin' = 'student') {
  const { message } = App.useApp()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const submit = useCallback(
    async (values: RegisterValues) => {
      // 基础前端校验（表单层已校验，这里兜底）
      if (!values.email || !values.password || !values.confirmPassword) {
        message.error('请填写所有必需字段')
        return
      }
      if (values.password !== values.confirmPassword) {
        message.error('密码与确认密码不一致')
        return
      }
      if (values.password.length < 6) {
        message.error('密码长度不能少于6位')
        return
      }
      if (!values.agree) {
        message.error('请阅读并同意用户协议与隐私政策')
        return
      }

      setLoading(true)
      try {
        await signUp(values.email, values.password, values.nickname || '', defaultRole)
        message.success('注册成功，请登录')
        navigate('/login')
      } catch (err: any) {
        message.error(parseRegisterError(err))
      } finally {
        setLoading(false)
      }
    },
    [defaultRole, message, navigate, signUp]
  )

  return { loading, submit }
}
