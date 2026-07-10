import { useCallback, useEffect, useState } from 'react'
import { App, Button, Checkbox, Divider, Space, Tag, Typography, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { Camera, ImageUp, ScanFace, Trash2 } from 'lucide-react'
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

type EnrollWay = 'camera' | 'photo' | null

const MAX_PHOTOS = 8
const PHOTO_MAX_SIDE = 1024
const PHOTO_JPEG_QUALITY = 0.85

/** 照片压缩为 base64（限制最长边，避免超过后端单帧上限） */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY)
}

export default function UserFaceSection({ userId }: { userId: number | string }) {
  const { message, modal } = App.useApp()
  const [status, setStatus] = useState<FaceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [consent, setConsent] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [actionMode, setActionMode] = useState(false)
  const [enrollWay, setEnrollWay] = useState<EnrollWay>(null)
  const [photoList, setPhotoList] = useState<UploadFile[]>([])

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

  const resetEnrollUi = useCallback(() => {
    setShowWizard(false)
    setConsent(false)
    setEnrollWay(null)
    setPhotoList([])
  }, [])

  const submitEnroll = useCallback(
    async (images: string[], mode: 'capture' | 'photo') => {
      if (!images.length) return
      setEnrolling(true)
      try {
        const res = await usersApi.faceEnroll(userId, { images, consent, mode })
        if (isSuccess(res)) {
          message.success(translate('auto.cc136bb2ad'))
          resetEnrollUi()
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
    [userId, consent, message, resetEnrollUi]
  )

  const handleCaptured = useCallback((images: string[]) => submitEnroll(images, 'capture'), [submitEnroll])

  const handlePhotoEnroll = useCallback(async () => {
    const files = photoList.map(f => f.originFileObj).filter((f): f is NonNullable<typeof f> => !!f)
    if (!files.length) {
      message.warning(translate('userFace.photo_required'))
      return
    }
    setEnrolling(true)
    try {
      const images = await Promise.all(files.map(f => fileToCompressedDataUrl(f as File)))
      await submitEnroll(images, 'photo')
    } catch (e: any) {
      message.error(e?.message || translate('userFace.photo_read_failed'))
      setEnrolling(false)
    }
  }, [photoList, message, submitEnroll])

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
            {!consent ? (
              <Text type="warning">{translate('auto.639c57b489')}</Text>
            ) : !enrollWay ? (
              <Space>
                <Button size="small" icon={<Camera size={14} />} onClick={() => setEnrollWay('camera')}>
                  {translate('userFace.camera_capture')}
                </Button>
                <Button size="small" icon={<ImageUp size={14} />} onClick={() => setEnrollWay('photo')}>
                  {translate('userFace.upload_photo')}
                </Button>
              </Space>
            ) : enrollWay === 'camera' ? (
              <FaceCaptureWizard auto actionMode={actionMode} busy={enrolling} onComplete={handleCaptured} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {translate('userFace.photo_hint')}
                </Text>
                <Upload
                  listType="picture-card"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  maxCount={MAX_PHOTOS}
                  fileList={photoList}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setPhotoList(fileList.slice(0, MAX_PHOTOS))}
                  disabled={enrolling}
                >
                  {photoList.length < MAX_PHOTOS && `+ ${translate('userFace.pick_photo')}`}
                </Upload>
                <Text type="warning" style={{ fontSize: 12 }}>
                  {translate('userFace.photo_mode_note')}
                </Text>
                <Button
                  size="small"
                  type="primary"
                  icon={<ImageUp size={14} />}
                  loading={enrolling}
                  disabled={!photoList.length}
                  onClick={handlePhotoEnroll}
                >
                  {translate('userFace.photo_confirm')}
                </Button>
              </Space>
            )}
            <Button size="small" onClick={resetEnrollUi} disabled={enrolling}>
              {translate('app.cancel')}</Button>
          </Space>
        )}
      </Space>
    </>
  )
}
