// features/settings/components/PrivacyCard.tsx
import { Select, Space, Switch } from 'antd'
import { Bell, Eye, Trophy } from 'lucide-react'
import React from 'react'
import type { PrivacySettings, ProfileVisibility } from '../../../shared/types/settings'
import { SettingRow } from './SettingRow'
import { SettingSection } from './SettingSection'

export const PrivacyCard: React.FC<{
  value: PrivacySettings
  onChange: (v: PrivacySettings) => void
  t: (k: string) => string
}> = ({ value, onChange, t }) => (
  <SettingSection title={t('settings.privacy')}>
    <Space direction="vertical" style={{ width: '100%' }}>
      <SettingRow
        icon={<Eye size={16} />}
        label={t('settings.profile_visibility')}
        control={
          <Select<ProfileVisibility>
            value={value.profile_visibility}
            onChange={v => onChange({ ...value, profile_visibility: v })}
            style={{ width: 140 }}
            options={[
              { label: t('settings.public'), value: 'public' },
              { label: t('settings.private'), value: 'private' },
            ]}
          />
        }
      />
      <SettingRow
        icon={<Bell size={16} />}
        label={t('settings.show_activity')}
        control={<Switch checked={value.show_activity} onChange={v => onChange({ ...value, show_activity: v })} />}
      />
      <SettingRow
        icon={<Trophy size={16} />}
        label={t('settings.show_results')}
        control={<Switch checked={value.show_results} onChange={v => onChange({ ...value, show_results: v })} />}
      />
    </Space>
  </SettingSection>
)
