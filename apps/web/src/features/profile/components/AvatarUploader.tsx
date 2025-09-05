// features/profile/components/AvatarUploader.tsx
import { Avatar } from 'antd'
import { Upload } from 'lucide-react'
import React from 'react'

export default function AvatarUploader({
  src,
  onPick,
  email,
  subtitle,
}: {
  src: string
  onPick: (file: File) => void
  email?: string
  subtitle?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
      <div style={{ position: 'relative' }}>
        <Avatar size={96} src={src} alt="avatar" />
        <label
          htmlFor="avatar-upload"
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
          title="上传头像"
        >
          <Upload style={{ width: 16, height: 16 }} />
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
            }}
          />
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {email ? <span style={{ fontWeight: 600 }}>{email}</span> : null}
        {subtitle ? <span style={{ color: '#999' }}>{subtitle}</span> : null}
      </div>
    </div>
  )
}
