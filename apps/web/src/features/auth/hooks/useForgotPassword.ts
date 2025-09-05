import { useCallback, useState } from 'react'
import { forgotPassword } from '@shared/api/http' // 继续使用现有 http 模块

export function useForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (email: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await forgotPassword(email)
      // 兼容 ApiResult 结构
      if ((res as any)?.success) {
        setSuccess(true)
      } else {
        const msg = (res as any)?.error || '发送重置邮件失败，请稍后重试'
        setError(msg)
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '发送重置邮件失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { loading, success, error, submit, clearError }
}
