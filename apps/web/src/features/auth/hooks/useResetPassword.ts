import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { validateResetToken as apiValidate, resetPassword as apiReset } from '@/shared/api/endpoints/auth'

export type ResetValues = { password: string; confirmPassword: string }

function pickError(err: any, fallback: string) {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err.error) return err.error
  if (err.message) return err.message
  return err?.response?.data?.message || fallback
}

/** 把被“套娃”的 token 还原成真正的 64位 hex 令牌 */
function normalizeToken(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const v = decodeURIComponent(raw)
    // 如果是完整 URL，再从里面取 token
    if (/^https?:\/\//i.test(v)) {
      const inner = new URL(v).searchParams.get('token')
      if (inner) return normalizeToken(inner)
    }
    // 直接提取 64 位十六进制片段
    const m = v.match(/\b[0-9a-fA-F]{64}\b/)
    return m ? m[0] : v
  } catch {
    return raw ?? null
  }
}

export function useResetPassword(rawToken: string | null) {
  const token = useMemo(() => normalizeToken(rawToken), [rawToken])

  const { message } = App.useApp()
  const navigate = useNavigate()

  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)
  const timerRef = useRef<number | null>(null)

  // 校验 token
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!token) {
        if (!mounted) return
        setError('重置链接无效或已过期')
        setValidating(false)
        setTokenValid(false)
        return
      }
      try {
        setValidating(true)
        const res = await apiValidate(token)
        if (!mounted) return
        if (res?.success && res?.data?.valid) {
          setTokenValid(true)
          setError(null)
        } else {
          setTokenValid(false)
          setError(pickError(res, '重置链接无效或已过期'))
        }
      } catch (err: any) {
        if (!mounted) return
        setTokenValid(false)
        setError(pickError(err, '重置链接无效或已过期'))
      } finally {
        if (!mounted) return
        setValidating(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [token])

  // 成功后倒计时与跳转
  useEffect(() => {
    if (!success) return
    timerRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          navigate('/login')
          return 0
        }
        return prev - 1
      })
    }, 1000) as unknown as number
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [success, navigate])

  const submit = useCallback(
    async (values: ResetValues) => {
      if (!token) {
        setError('重置令牌无效')
        return
      }
      if (!values.password || !values.confirmPassword) {
        message.error('请填写新密码与确认密码')
        return
      }
      if (values.password !== values.confirmPassword) {
        message.error('两次输入的密码不一致')
        return
      }
      if (values.password.length < 6) {
        message.error('密码长度至少6位')
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await apiReset(token, values.password, values.confirmPassword)
        if (res?.success) {
          setSuccess(true)
        } else {
          setError(pickError(res, '密码重置失败，请稍后重试'))
        }
      } catch (err: any) {
        setError(pickError(err, '密码重置失败，请稍后重试'))
      } finally {
        setLoading(false)
      }
    },
    [message, token]
  )

  const status = useMemo<'validating' | 'invalid' | 'form' | 'success'>(() => {
    if (validating) return 'validating'
    if (success) return 'success'
    if (!tokenValid) return 'invalid'
    return 'form'
  }, [validating, tokenValid, success])

  const clearError = useCallback(() => setError(null), [])

  return {
    status,
    validating,
    tokenValid,
    loading,
    success,
    error,
    countdown,
    submit,
    clearError,
  }
}

export default useResetPassword
