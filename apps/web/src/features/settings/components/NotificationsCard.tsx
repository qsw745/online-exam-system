import { Space, Switch } from 'antd'
import { Mail, Smartphone, Volume2 } from 'lucide-react'
import React from 'react'
import type { NotificationSettings } from '../../../shared/types/settings'
import { SettingRow } from './SettingRow'
import { SettingSection } from './SettingSection'

export const NotificationsCard: React.FC<{
  value: NotificationSettings
  onChange: (v: NotificationSettings) => void
  title: string
}> = ({ value, onChange, title }) => (
  <SettingSection title={title}>
    <Space direction="vertical" style={{ width: '100%' }}>
      <SettingRow
        icon={<Mail size={16} />}
        label="Email"
        control={<Switch checked={value.email} onChange={v => onChange({ ...value, email: v })} />}
      />
      <SettingRow
        icon={<Smartphone size={16} />}
        label="Push"
        control={<Switch checked={value.push} onChange={v => onChange({ ...value, push: v })} />}
      />
      <SettingRow
        icon={<Volume2 size={16} />}
        label="Sound"
        control={<Switch checked={value.sound} onChange={v => onChange({ ...value, sound: v })} />}
      />
    </Space>
  </SettingSection>
)
