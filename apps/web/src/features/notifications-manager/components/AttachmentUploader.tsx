import React, { useEffect, useState } from 'react'
import { Upload, UploadFile, message, Space, Button } from 'antd'
import type { UploadProps } from 'antd'
import type { RcFile } from 'antd/es/upload/interface'
import { notificationUploadsApi } from '@/shared/api/endpoints/notificationUploads'
import { translate } from '@/shared/utils/i18n'

type RcCustomRequestOptions = Parameters<NonNullable<UploadProps['customRequest']>>[0]

export type NotificationAttachment = {
  id: number
  file_name: string
  url: string
  file_size: number
  mime_type?: string
}

const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB

async function fileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function uploadAttachment(file: RcFile, onProgress?: (percent: number) => void) {
  const hash = await fileHash(file)
  const check = await notificationUploadsApi.check({ hash })
  if (check.exists && check.attachment) return check.attachment

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const uploaded = new Set(check.uploadedChunks || [])

  for (let index = 0; index < totalChunks; index += 1) {
    if (uploaded.has(index)) continue
    const start = index * CHUNK_SIZE
    const end = Math.min(file.size, start + CHUNK_SIZE)
    const chunk = file.slice(start, end)
    const form = new FormData()
    form.append('hash', hash)
    form.append('index', String(index))
    form.append('chunk', chunk, file.name)
    await notificationUploadsApi.uploadChunk(form)
    if (onProgress) onProgress(Math.round(((index + 1) / totalChunks) * 100))
  }

  const merged = await notificationUploadsApi.merge({
    hash,
    filename: file.name,
    mime_type: file.type,
    totalChunks,
    size: file.size,
  })
  return merged.attachment
}

export default function AttachmentUploader({
  value,
  onChange,
}: {
  value?: NotificationAttachment[]
  onChange?: (list: NotificationAttachment[]) => void
}) {
  const [fileList, setFileList] = useState<UploadFile[]>([])

  useEffect(() => {
    const list = (value || []).map(att => ({
      uid: String(att.id),
      name: att.file_name,
      status: 'done' as const,
      url: att.url,
      size: att.file_size,
    }))
    setFileList(list)
  }, [value])

  const triggerChange = (list: NotificationAttachment[]) => {
    onChange?.(list)
  }

  const performUpload = async (options: RcCustomRequestOptions) => {
    const { file, onError, onSuccess, onProgress } = options
    try {
      const attachment = await uploadAttachment(file as RcFile, percent => {
        onProgress?.({ percent })
      })
      const next = [...(value || []), attachment]
      triggerChange(next)
      onSuccess?.(attachment, new XMLHttpRequest())
      const fileName =
        typeof file === 'string' ? file : 'name' in file ? (file as RcFile).name : '文件'
      message.success(`${fileName} 上传成功`)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || translate('files.messages.upload_failed'))
      onError?.(e as Error)
    }
  }
  const customRequest: UploadProps['customRequest'] = options => {
    void performUpload(options as RcCustomRequestOptions)
  }

  const handleRemove = (file: UploadFile) => {
    const next = (value || []).filter(att => att.file_name !== file.name || String(att.id) !== file.uid)
    triggerChange(next)
    return true
  }

  return (
    <Upload.Dragger
      multiple
      customRequest={customRequest}
      fileList={fileList}
      onRemove={handleRemove}
      itemRender={(origin, _, fileList) => origin}
    >
      <Space direction="vertical">
        <p>{translate('auto.dc8f3b9860')}</p>
        <Button type="primary">{translate('auto.21a6f5a8d9')}</Button>
      </Space>
    </Upload.Dragger>
  )
}
