import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Checkbox, Space, Tag, Typography } from 'antd'
import { ScanFace, Trash2 } from 'lucide-react'
import FaceCaptureWizard from '@/features/auth/components/FaceCaptureWizard'
import { auth } from '@/shared/api/endpoints/auth'
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { isSuccess, getErr } from '@/shared/api/core/types'
import { translate } from '@/shared/utils/i18n'

const { Text, Paragraph } = Typography

type FaceStatus = {
  enrolled: boolean
  samples: number
  model: string | null
  updatedAt: string | null
}

export default function FaceLoginCard() {
  const { message, modal } = App.useApp()
  const [status, setStatus] = useState<FaceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [consent, setConsent] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [actionMode, setActionMode] = useState(false)

  const refresh = useCallback(async () => {
    const res = await auth.faceStatus()
    if (isSuccess(res)) setStatus(res.data)
  }, [])

  useEffect(() => {
    refresh()
    adminSettingsApi
      .getPublic()
      .then(s => setActionMode((s as any)?.enrollLivenessLevel === 'action'))
      .catch(() => {})
  }, [refresh])

  const handleCaptured = useCallback(
    async (images: string[]) => {
      if (!images.length) return
      setEnrolling(true)
      try {
        const res = await auth.faceEnroll({ images, consent })
        if (isSuccess(res)) {
          message.success(translate('auto.cc136bb2ad'))
          setShowWizard(false)
          setConsent(false)
          setStatus(res.data)
        } else {
          message.error(getErr(res, '人脸录入失败'))
        }
      } catch (e: any) {
        message.error(e?.message || translate('auto.7ce2fb021a'))
      } finally {
        setEnrolling(false)
      }
    },
    [consent, message]
  )

  const handleUnenroll = useCallback(() => {
    modal.confirm({
      title: translate('auto.cd525b013e'),
      content: translate('auto.3b2d9e38a2'),
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true)
        try {
          const res = await auth.faceUnenroll()
          if (isSuccess(res)) {
            message.success(translate('auto.29e543b387'))
            await refresh()
          } else {
            message.error(getErr(res, '解绑失败'))
          }
        } finally {
          setLoading(false)
        }
      },
    })
  }, [modal, message, refresh])

  return (
    <Card
      title={
        <Space>
          <ScanFace size={18} />
          <span>{translate('auth.face_login')}</span>
          {status?.enrolled ? (
            <Tag color="green">{translate('auto.6e2e0f5458')}{status.samples} {translate('auto.302d5937d6')}</Tag>
          ) : (
            <Tag>{translate('auto.3bf179d8d0')}</Tag>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {translate('auto.94c7392471')}</Paragraph>

        {!showWizard && (
          <Space>
            <Button type="primary" icon={<ScanFace size={16} />} onClick={() => setShowWizard(true)}>
              {status?.enrolled ? translate('visible.3e3c059366') : translate('visible.f198e8961f')}
            </Button>
            {status?.enrolled && (
              <Button danger icon={<Trash2 size={16} />} loading={loading} onClick={handleUnenroll}>
                {translate('auto.80d59b5959')}</Button>
            )}
          </Space>
        )}

        {showWizard && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Checkbox checked={consent} onChange={e => setConsent(e.target.checked)}>
              <Text>
                {translate('auto.42a3aec383')}</Text>
            </Checkbox>

            {consent ? (
              <FaceCaptureWizard auto actionMode={actionMode} busy={enrolling} onComplete={handleCaptured} />
            ) : (
              <Text type="warning">{translate('auto.36ee4162ff')}</Text>
            )}

            <Button onClick={() => { setShowWizard(false); setConsent(false) }} disabled={enrolling}>
              {translate('app.cancel')}</Button>
          </Space>
        )}
      </Space>
    </Card>
  )
}
