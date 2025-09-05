// features/profile/components/ProfileForm.tsx
import { Form, Input } from 'antd'
import React from 'react'
import type { ProfileForm as ProfileFormType } from '@features/profile/api'

export default function ProfileForm({
  value,
  onChange,
  t,
}: {
  value: ProfileFormType
  onChange: (patch: Partial<ProfileFormType>) => void
  t: (k: string) => string
}) {
  return (
    <Form layout="vertical" requiredMark={false}>
      <Form.Item label={t('profile.nickname')} required rules={[{ required: true }]}>
        <Input
          value={value.nickname}
          onChange={e => onChange({ nickname: e.target.value })}
          placeholder={`${t('app.enter')} ${t('profile.nickname')}`}
          maxLength={64}
        />
      </Form.Item>
      <Form.Item label={t('profile.school')}>
        <Input
          value={value.school}
          onChange={e => onChange({ school: e.target.value })}
          placeholder={`${t('app.enter')} ${t('profile.school')}`}
          maxLength={64}
        />
      </Form.Item>
      <Form.Item label={t('profile.class')}>
        <Input
          value={value.class_name}
          onChange={e => onChange({ class_name: e.target.value })}
          placeholder={`${t('app.enter')} ${t('profile.class')}`}
          maxLength={64}
        />
      </Form.Item>
    </Form>
  )
}
