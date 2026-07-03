import { Form, Input } from 'antd'
import React from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { translate } from '@/shared/utils/i18n'

export type ProfileFormType = {
  nickname: string
  school?: string
  class_name?: string
  email?: string
  phone?: string
  bio?: string
}

export default function ProfileForm({
  value,
  onChange,
}: {
  value: ProfileFormType
  onChange: (patch: Partial<ProfileFormType>) => void
}) {
  const { t } = useLanguage()
  // 简单的 i18n 安全获取：无翻译时回退中文
  const L = (k: string, fallback: string) => {
    const s = t(k)
    return s === k ? fallback : s
  }

  return (
    <Form layout="vertical" requiredMark={false}>
      <Form.Item label={L('profile.nickname', translate('profile.nickname'))} required rules={[{ required: true }]}>
        <Input
          value={value.nickname}
          onChange={e => onChange({ nickname: e.target.value })}
          placeholder={`${L('app.enter', translate('app.enter'))} ${L('profile.nickname', translate('profile.nickname'))}`}
          maxLength={64}
        />
      </Form.Item>

      <Form.Item label={L('profile.email', translate('auth.email'))}>
        <Input
          type="email"
          value={value.email}
          onChange={e => onChange({ email: e.target.value })}
          placeholder={`${L('app.enter', translate('app.enter'))} ${L('profile.email', translate('auth.email'))}`}
          maxLength={120}
        />
      </Form.Item>

      <Form.Item label={L('profile.phone', translate('auto.e02f6e5760'))}>
        <Input
          value={value.phone}
          onChange={e => onChange({ phone: e.target.value })}
          placeholder={`${L('app.enter', translate('app.enter'))} ${L('profile.phone', translate('auto.e02f6e5760'))}`}
          maxLength={32}
        />
      </Form.Item>

      <Form.Item label={L('profile.school', translate('profile.school'))}>
        <Input
          value={value.school}
          onChange={e => onChange({ school: e.target.value })}
          placeholder={`${L('app.enter', translate('app.enter'))} ${L('profile.school', translate('profile.school'))}`}
          maxLength={64}
        />
      </Form.Item>

      <Form.Item label={L('profile.class', translate('profile.class'))}>
        <Input
          value={value.class_name}
          onChange={e => onChange({ class_name: e.target.value })}
          placeholder={`${L('app.enter', translate('app.enter'))} ${L('profile.class', translate('profile.class'))}`}
          maxLength={64}
        />
      </Form.Item>

      <Form.Item label={L('profile.bio', translate('visible.5ea2e0cde2'))}>
        <Input.TextArea
          value={value.bio}
          onChange={e => onChange({ bio: e.target.value })}
          placeholder={L('profile.bio_placeholder', translate('visible.20631e20f9'))}
          maxLength={300}
          rows={4}
          showCount
        />
      </Form.Item>
    </Form>
  )
}
