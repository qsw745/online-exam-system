import { Avatar, Modal, Tooltip } from 'antd'
import { Upload, User as UserIcon, Maximize2 } from 'lucide-react'
import React, { useId, useState } from 'react'
import { translate } from '@/shared/utils/i18n'

export default function AvatarUploader({
  src,
  onPick,
  email,
  subtitle,
}: {
  src?: string | null
  onPick: (file: File) => void
  email?: string
  subtitle?: string
}) {
  const inputId = useId()
  const safeSrc = src || undefined
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
      <div style={{ position: 'relative' }}>
        <Tooltip title={safeSrc ? translate('visible.d730178fef') : undefined}>
          <Avatar
            size={96}
            src={safeSrc}
            alt="avatar"
            style={{ cursor: safeSrc ? 'zoom-in' : 'default' }}
            onClick={() => safeSrc && setPreviewOpen(true)}
          >
            {!safeSrc ? <UserIcon size={28} /> : null}
          </Avatar>
        </Tooltip>

        {/* 右下角上传按钮 */}
        <label
          htmlFor={inputId}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            padding: 4,
            backgroundColor: '#1890ff',
            color: 'white',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={translate('users.action.upload_avatar')}
        >
          <Upload style={{ width: 16, height: 16 }} />
          <input
            id={inputId}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
            }}
          />
        </label>

        {/* 左上角查看图标 */}
        {safeSrc ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title={translate('auto.c09b520714')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              border: 'none',
              background: 'rgba(0,0,0,.45)',
              color: '#fff',
              width: 24,
              height: 24,
              borderTopLeftRadius: 999,
              borderBottomRightRadius: 8,
              display: 'grid',
              placeItems: 'center',
              cursor: 'zoom-in',
            }}
          >
            <Maximize2 size={14} />
          </button>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {email ? <span style={{ fontWeight: 600 }}>{email}</span> : null}
        {subtitle ? <span style={{ color: '#999' }}>{subtitle}</span> : null}
      </div>

      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        centered
        destroyOnHidden
        styles={{ body: { padding: 0 } }} // ← 替代 bodyStyle
      >
        {safeSrc ? <img src={safeSrc} alt="avatar preview" style={{ display: 'block', width: '100%' }} /> : null}
      </Modal>
    </div>
  )
}
