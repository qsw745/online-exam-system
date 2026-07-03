import { App } from 'antd'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/contexts/AuthContext'
import { translate } from '@/shared/utils/i18n'

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
        const details = err?.response?.data?.error?.details
        if (Array.isArray(details) && details.length) {
          const first = details[0]
          if (first?.field === 'email') return '邮箱已被占用或格式不正确'
          if (first?.field === 'username') return '用户名已被占用，请更换后再试'
        }
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

export function useRegister() {
  const { message } = App.useApp()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const submit = useCallback(
    async (values: RegisterValues) => {
      // 基础前端校验（表单层已校验，这里兜底）
      if (!values.email || !values.password || !values.confirmPassword) {
        message.error(translate('auto.f59ba47760'))
        return
      }
      if (values.password !== values.confirmPassword) {
        message.error(translate('auto.eddee1f9e9'))
        return
      }
      if (values.password.length < 6) {
        message.error(translate('auto.3add9a5261'))
        return
      }
      if (!values.agree) {
        message.error(translate('auto.d5bb8bc505'))
        return
      }

      setLoading(true)
      try {
        const res = await signUp(values.email, values.password, { nickname: values.nickname || undefined })
        if (res?.needVerification) {
          message.success(translate('auto.2fc1f72de8'))
        } else {
          message.success(translate('auto.5fcfe1534e'))
        }
        navigate('/login')
      } catch (err: any) {
        message.error(parseRegisterError(err))
      } finally {
        setLoading(false)
      }
    },
    [message, navigate, signUp]
  )

  return { loading, submit }
}
