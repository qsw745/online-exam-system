import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Card, Input, Result, Space, Spin, Typography } from 'antd'
import { auth as authApi } from '@/shared/api/endpoints/auth'
import { isSuccess, getErr } from '@/shared/api/core/types'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type Phase = 'verifying' | 'success' | 'failed'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [phase, setPhase] = useState<Phase>('verifying')
  const [errMsg, setErrMsg] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resentTip, setResentTip] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // 防 StrictMode 双跑消费 token
    ran.current = true
    ;(async () => {
      if (!token) {
        setPhase('failed')
        setErrMsg('缺少验证 token，请通过邮件中的链接打开')
        return
      }
      const res = await authApi.verifyEmail(token)
      if (isSuccess(res) && res.data?.verified) {
        setPhase('success')
      } else {
        setPhase('failed')
        setErrMsg(getErr(res, '验证链接无效或已过期'))
      }
    })()
  }, [token])

  const handleResend = async () => {
    if (!resendEmail.trim()) return
    setResending(true)
    setResentTip('')
    try {
      await authApi.resendVerification(resendEmail.trim())
      setResentTip('若该邮箱存在且未验证，新的验证邮件已发送，请查收。')
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 460 }} title={translate('auto.25a7dbc562')}>
        {phase === 'verifying' && (
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <Spin />
            <Text type="secondary">{translate('auto.36a20a8295')}</Text>
          </Space>
        )}

        {phase === 'success' && (
          <Result
            status="success"
            title={translate('auto.4a9829b8a3')}
            subTitle={translate('visible.8e3304248c')}
            extra={
              <Link to="/login">
                <Button type="primary">{translate('auto.c2ac8f1515')}</Button>
              </Link>
            }
          />
        )}

        {phase === 'failed' && (
          <Result
            status="error"
            title={translate('auto.31231e79d7')}
            subTitle={errMsg}
            extra={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input
                  placeholder={translate('auto.38200c5507')}
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                />
                <Button loading={resending} onClick={handleResend} block>
                  {translate('auto.06d80dfad4')}</Button>
                {resentTip && <Text type="success">{resentTip}</Text>}
                <Link to="/login">{translate('auto.f2fe4ecc0f')}</Link>
              </Space>
            }
          />
        )}
      </Card>
    </div>
  )
}
