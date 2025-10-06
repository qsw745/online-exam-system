import { Form, Input } from 'antd'
import React from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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
      <Form.Item label={L('profile.nickname', '昵称')} required rules={[{ required: true }]}>
        <Input
          value={value.nickname}
          onChange={e => onChange({ nickname: e.target.value })}
          placeholder={`${L('app.enter', '请输入')} ${L('profile.nickname', '昵称')}`}
          maxLength={64}
        />
      </Form.Item>

      <Form.Item label={L('profile.email', '邮箱')}>
        <Input
          type="email"
          value={value.email}
          onChange={e => onChange({ email: e.target.value })}
          placeholder={`${L('app.enter', '请输入')} ${L('profile.email', '邮箱')}`}
          maxLength={120}
        />
      </Form.Item>

      <Form.Item label={L('profile.phone', '联系电话')}>
        <Input
          value={value.phone}
          onChange={e => onChange({ phone: e.target.value })}
          placeholder={`${L('app.enter', '请输入')} ${L('profile.phone', '联系电话')}`}
          maxLength={32}
        />
      </Form.Item>

      <Form.Item label={L('profile.school', '学校')}>
        <Input
          value={value.school}
          onChange={e => onChange({ school: e.target.value })}
          placeholder={`${L('app.enter', '请输入')} ${L('profile.school', '学校')}`}
          maxLength={64}
        />
      </Form.Item>

      <Form.Item label={L('profile.class', '班级')}>
        <Input
          value={value.class_name}
          onChange={e => onChange({ class_name: e.target.value })}
          placeholder={`${L('app.enter', '请输入')} ${L('profile.class', '班级')}`}
          maxLength={64}
        />
      </Form.Item>

      <Form.Item label={L('profile.bio', '简介')}>
        <Input.TextArea
          value={value.bio}
          onChange={e => onChange({ bio: e.target.value })}
          placeholder={L('profile.bio_placeholder', '一句话介绍自己…')}
          maxLength={300}
          rows={4}
          showCount
        />
      </Form.Item>
    </Form>
  )
}
