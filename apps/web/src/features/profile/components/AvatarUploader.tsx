import { Avatar, Modal } from 'antd'
import { Upload, User as UserIcon } from 'lucide-react'
import React, { useId, useState } from 'react'
import { translate } from '@/shared/utils/i18n'

export default function AvatarUploader({
  src,
  onPick,
  email,
  subtitle,
  disabled,
}: {
  disabled?: boolean
  src?: string | null
  onPick: (file: File) => void
  email?: string
  subtitle?: string
}) {
  const inputId = useId()
  const [failedSrc, setFailedSrc] = useState<string>()
  const safeSrc = src && src !== failedSrc ? src : undefined
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div className="student-avatar" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
      <div>
        <button className="student-avatar__preview" type="button" disabled={!safeSrc} aria-label={translate('auto.c09b520714')} onClick={() => safeSrc && setPreviewOpen(true)}>
          <Avatar
            className="student-avatar__image"
            size={96}
            src={safeSrc}
            alt="头像"
            onError={() => { setFailedSrc(safeSrc); return true }}
          >
            <UserIcon size={28} />
          </Avatar>
        </button>
      </div>

      <div className="student-avatar__copy" style={{ display: 'flex', flexDirection: 'column' }}>
        {email ? <span style={{ fontWeight: 600 }}>{email}</span> : null}
        {subtitle ? <span style={{ color: 'var(--ant-color-text-secondary)' }}>{subtitle}</span> : null}
      </div>

      <label className="student-avatar__upload" htmlFor={inputId} title={translate('users.action.upload_avatar')}>
        <Upload size={20} aria-hidden="true" />
        <input id={inputId} type="file" disabled={disabled} aria-label={translate('users.action.upload_avatar')} accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onPick(file)
            e.target.value = ''
          }} />
      </label>

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
