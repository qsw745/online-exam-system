// src/features/settings/components/AppearanceCard.tsx
import { Button, Select, Space, Typography } from 'antd'
import { Globe, Moon, Palette, Sun } from 'lucide-react'
import React from 'react'
import type { AppearanceSettings } from '@/shared/types/settings'
import { SettingRow } from './SettingRow'
import { SettingSection } from './SettingSection'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useTheme } from '@/app/providers/AntdThemeProvider'

const { Text } = Typography

export const AppearanceCard: React.FC<{
  value: AppearanceSettings
  onChange: (v: AppearanceSettings) => void
  mode?: 'light' | 'dark'
  toggleTheme?: () => void
  t?: (k: string) => string
}> = ({ value, onChange, mode: modeProp, toggleTheme: toggleProp, t: tProp }) => {
  const { t: ctxT } = useLanguage()
  const { mode: ctxMode, toggle: ctxToggle } = useTheme()
  const t = tProp ?? ctxT
  const mode = modeProp ?? ctxMode
  const toggleTheme = toggleProp ?? ctxToggle

  return (
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
}
