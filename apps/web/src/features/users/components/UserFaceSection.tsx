import { useCallback, useEffect, useState } from 'react'
import { App, Button, Checkbox, Divider, Space, Tag, Typography } from 'antd'
import { ScanFace, Trash2 } from 'lucide-react'
import FaceCaptureWizard from '@/features/auth/components/FaceCaptureWizard'
import { usersApi } from '@/shared/api/endpoints/users'
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { isSuccess, getErr } from '@/shared/api/core/types'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type FaceStatus = {
  enrolled: boolean
  samples: number
  model: string | null
  updatedAt: string | null
}

export default function UserFaceSection({ userId }: { userId: number | string }) {
  const { message, modal } = App.useApp()
  const [status, setStatus] = useState<FaceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [consent, setConsent] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [actionMode, setActionMode] = useState(false)

  const refresh = useCallback(async () => {
    const res = await usersApi.faceStatus(userId)
    if (isSuccess(res)) setStatus(res.data)
  }, [userId])

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
        const res = await usersApi.faceEnroll(userId, { images, consent })
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
    [userId, consent, message]
  )

  const handleClear = useCallback(() => {
    modal.confirm({
      title: translate('auto.d784eaaf53'),
      content: translate('auto.f4538428b5'),
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true)
        try {
          const res = await usersApi.faceUnenroll(userId)
          if (isSuccess(res)) {
            message.success(translate('auto.f946aa803e'))
            await refresh()
          } else {
            message.error(getErr(res, '清除失败'))
          }
        } finally {
          setLoading(false)
        }
      },
    })
  }, [userId, modal, message, refresh])

  return (
    <>
      <Divider style={{ margin: '12px 0' }} />
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <ScanFace size={16} />
          <Text strong>{translate('auto.5b3b904030')}</Text>
          {status?.enrolled ? (
            <Tag color="green">{translate('auto.6e2e0f5458')}{status.samples} {translate('auto.302d5937d6')}</Tag>
          ) : (
            <Tag>{translate('auto.3bf179d8d0')}</Tag>
          )}
        </Space>

        {!showWizard ? (
          <Space>
            <Button size="small" icon={<ScanFace size={14} />} onClick={() => setShowWizard(true)}>
              {status?.enrolled ? translate('visible.fd6972ab28') : translate('visible.f198e8961f')}
            </Button>
            {status?.enrolled && (
              <Button size="small" danger icon={<Trash2 size={14} />} loading={loading} onClick={handleClear}>
                {translate('auto.7b15e5e8e7')}</Button>
            )}
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Checkbox checked={consent} onChange={e => setConsent(e.target.checked)}>
              {translate('auto.3ba099147d')}</Checkbox>
            {consent ? (
              <FaceCaptureWizard auto actionMode={actionMode} busy={enrolling} onComplete={handleCaptured} />
            ) : (
              <Text type="warning">{translate('auto.639c57b489')}</Text>
            )}
            <Button size="small" onClick={() => { setShowWizard(false); setConsent(false) }} disabled={enrolling}>
              {translate('app.cancel')}</Button>
          </Space>
        )}
      </Space>
    </>
  )
}
