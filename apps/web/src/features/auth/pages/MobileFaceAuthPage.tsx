import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Card, Result, Space, Spin, Typography } from 'antd'
import FaceCaptureWizard from '../components/FaceCaptureWizard'
import { auth as authApi, type FaceLoginCandidate } from '@/shared/api/endpoints/auth'
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
  const [errMsg, setErrMsg] = useState('')
  const [actionMode, setActionMode] = useState(false)
  const [candidates, setCandidates] = useState<FaceLoginCandidate[]>([])

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
        } else if (isSuccess(res) && res.data.reason === 'multiple_matches' && Array.isArray(res.data.candidates)) {
          setCandidates(res.data.candidates)
          setPhase('ready')
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

  const handleCandidateSelect = useCallback(
    async (choiceId: string) => {
      if (!choiceId) return
      setPhase('submitting')
      try {
        const res = await authApi.qrSelect({ ticket, choiceId })
        if (isSuccess(res) && res.data.ok) {
          setPhase('success')
          return
        }
        const msg = isSuccess(res) ? res.data.message || '人脸认证未通过' : getErr(res, '人脸认证失败')
        message.error(msg)
        setCandidates([])
        setPhase('ready')
      } catch (e: any) {
        message.error(e?.message || translate('auto.da763562b4'))
        setCandidates([])
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
            {candidates.length > 0 ? (
              <>
                <Text strong>{translate('auth.face_multiple_accounts')}</Text>
                {candidates.map(candidate => (
                  <Button
                    key={candidate.choiceId}
                    block
                    loading={phase === 'submitting'}
                    onClick={() => handleCandidateSelect(candidate.choiceId)}
                    style={{ height: 'auto', padding: '10px 12px', textAlign: 'left' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{candidate.displayName}</span>
                      <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                        {candidate.maskedEmail}{candidate.role ? ` · ${candidate.role}` : ''}
                      </span>
                    </span>
                  </Button>
                ))}
                <Button onClick={() => setCandidates([])} disabled={phase === 'submitting'}>
                  {translate('auth.face_recapture')}
                </Button>
              </>
            ) : (
              <>
                <Text type="secondary">{translate('visible.a4aed56b5d')}</Text>
                <FaceCaptureWizard auto actionMode={actionMode} busy={phase === 'submitting'} onComplete={handleCaptured} />
              </>
            )}
          </Space>
        )}
      </Card>
    </div>
  )
}
