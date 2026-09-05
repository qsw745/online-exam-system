import { resetPassword as apiReset, validateResetToken as apiValidate } from '@/shared/api/endpoints/auth'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

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
  const [validatedToken, setValidatedToken] = useState<string | null>(null)
  const tokenValid = Boolean(token && validatedToken === token)
  const [loading, setLoading] = useState(false)
  const [successToken, setSuccessToken] = useState<string | null>(null)
  const success = Boolean(token && successToken === token)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)
  const inFlight = useRef(false)
  const requestVersion = useRef(0)

  // 校验 token
  useEffect(() => {
    let mounted = true
    requestVersion.current += 1
    ;(async () => {
      if (!token) {
        if (!mounted) return
        setError('重置链接无效或已过期')
        setValidating(false)
        setValidatedToken(null)
        return
      }
      try {
        setValidating(true)
        // ✅ 最小返回形状，避免 TS 在联合里报错
        const res = (await apiValidate(token)) as { success?: boolean; data?: { valid?: boolean } }
        if (!mounted) return
        if (res?.success && res?.data?.valid) {
          setValidatedToken(token)
          setError(null)
        } else {
          setValidatedToken(null)
          setError(pickError(res, '重置链接无效或已过期'))
        }
      } catch (err: any) {
        if (!mounted) return
        setValidatedToken(null)
        setError(pickError(err, '重置链接无效或已过期'))
      } finally {
        if (mounted) setValidating(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [token])

  // 导航在独立 effect 中执行，避免在状态更新函数中触发路由更新。
  useEffect(() => {
    if (!success || countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [success, countdown])
  useEffect(() => {
    if (success && countdown === 0) navigate('/login', { replace: true })
  }, [success, countdown, navigate])

  const submit = useCallback(
    async (values: ResetValues) => {
      if (inFlight.current || success) return
      if (!token || !tokenValid || validating) {
        setError('重置令牌无效')
        return
      }
      if (!values.password || !values.confirmPassword) {
        message.error(translate('auto.21cad2124d'))
        return
      }
      if (values.password !== values.confirmPassword) {
        message.error(translate('auto.3e2b222d98'))
        return
      }
      if (values.password.length < 6) {
        message.error(translate('auto.3bbd0a8411'))
        return
      }

      const version = requestVersion.current
      inFlight.current = true
      setLoading(true)
      setError(null)
      try {
        const res = await apiReset(token, values.password, values.confirmPassword)
        if (version !== requestVersion.current) return
        if (res?.success) {
          setCountdown(3)
          setSuccessToken(token)
        } else {
          setError(pickError(res, '密码重置失败，请稍后重试'))
        }
      } catch (err: any) {
        if (version !== requestVersion.current) return
        setError(pickError(err, '密码重置失败，请稍后重试'))
      } finally {
        inFlight.current = false
        setLoading(false)
      }
    },
    [message, token, tokenValid, validating, success]
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
