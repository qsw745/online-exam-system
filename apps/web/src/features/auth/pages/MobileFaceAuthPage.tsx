import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Card, Result, Space, Spin, Typography } from 'antd'
import FaceCaptureWizard from '../components/FaceCaptureWizard'
import { auth as authApi } from '@/shared/api/endpoints/auth'
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { isSuccess, getErr } from '@/shared/api/core/types'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type Phase = 'loading' | 'ready' | 'submitting' | 'success' | 'expired' | 'error'

export default function MobileFaceAuthPage() {
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const ticket = params.get('ticket') || ''
  const [phase, setPhase] = useState<Phase>('loading')
  const [emailHint, setEmailHint] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [actionMode, setActionMode] = useState(false)

  useEffect(() => {
    adminSettingsApi
      .getPublic()
      .then(s => setActionMode((s as any)?.loginLivenessLevel === 'action'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!ticket) {
        setPhase('error')
        setErrMsg('缺少二维码票据，请重新扫码')
        return
      }
      const res = await authApi.qrInfo(ticket)
      if (!isSuccess(res)) {
        setPhase('error')
        setErrMsg(getErr(res, '二维码无效'))
        return
      }
      if (res.data.status === 'expired') {
        setPhase('expired')
        return
      }
      setEmailHint(res.data.emailHint || '')
      setPhase('ready')
    })()
  }, [ticket])

  const handleCaptured = useCallback(
    async (images: string[]) => {
      if (!images.length) return
      setPhase('submitting')
      try {
        const res = await authApi.qrAuthorize({ ticket, images })
        if (isSuccess(res) && res.data.ok) {
          setPhase('success')
        } else {
          const msg = isSuccess(res) ? res.data.message || '人脸认证未通过' : getErr(res, '人脸认证失败')
          message.error(msg)
          setPhase('ready')
        }
      } catch (e: any) {
        message.error(e?.message || translate('auto.da763562b4'))
        setPhase('ready')
      }
    },
    [ticket, message]
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 420 }} title={translate('auto.34e21d04a1')}>
        {phase === 'loading' && (
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <Spin />
            <Text type="secondary">{translate('auto.5d2889e6b1')}</Text>
          </Space>
        )}

        {phase === 'expired' && (
          <Result status="warning" title={translate('auto.0452657644')} subTitle={translate('visible.dacd0c539a')} />
        )}
        {phase === 'error' && <Result status="error" title={translate('auto.1e838101f0')} subTitle={errMsg} />}
        {phase === 'success' && (
          <Result status="success" title={translate('auto.2226c02661')} subTitle={translate('visible.72a354e585')} />
        )}

        {(phase === 'ready' || phase === 'submitting') && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Text type="secondary">
              {translate('auto.828fdd0b4a')}<Text strong>{emailHint || translate('visible.4d6827b1e0')}</Text> {translate('auto.766bc0e9e0')}</Text>
            <FaceCaptureWizard auto actionMode={actionMode} busy={phase === 'submitting'} onComplete={handleCaptured} />
          </Space>
        )}
      </Card>
    </div>
  )
}
