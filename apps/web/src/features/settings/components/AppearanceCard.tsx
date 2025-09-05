// features/settings/components/AppearanceCard.tsx
import { Button, Select, Space, Typography } from 'antd'
import { Globe, Moon, Sun, Palette } from 'lucide-react'
import React from 'react'
import { SettingSection } from './SettingSection'
import { SettingRow } from './SettingRow'
import type { AppearanceSettings } from '../types/settings'

const { Text } = Typography

export const AppearanceCard: React.FC<{
  value: AppearanceSettings
  onChange: (v: AppearanceSettings) => void
  mode: 'light' | 'dark'
  toggleTheme: () => void
  t: (k: string) => string
}> = ({ value, onChange, mode, toggleTheme, t }) => (
  <SettingSection title={t('settings.appearance')}>
    <Space direction="vertical" style={{ width: '100%' }}>
      <SettingRow
        icon={<Palette size={16} />}
        label={t('settings.theme')}
        control={
          <Button
            onClick={toggleTheme}
            aria-label="toggle-theme"
            icon={mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          />
        }
      />
      <SettingRow
        icon={<Globe size={16} />}
        label={<Text>{t('settings.language')}</Text>}
        control={
          <Select
            value={value.language}
            onChange={v => onChange({ ...value, language: v })}
            style={{ width: 140 }}
            options={[
              { value: 'zh-CN', label: t('language.zh-CN') },
              { value: 'en-US', label: t('language.en-US') },
            ]}
          />
        }
      />
    </Space>
  </SettingSection>
)
