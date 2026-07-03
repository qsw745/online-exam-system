// src/features/settings/pages/tabs/PreferencesTab.tsx
import React from 'react'
import { Spin, Space, Typography, Button } from 'antd'
import { Save } from 'lucide-react'
import { useTheme } from '@/app/providers/AntdThemeProvider'
import { useUserSettings } from '@/features/settings/hooks/useUserSettings'
import { AppearanceCard } from '@/features/settings/components/AppearanceCard'
import { NotificationsCard } from '@/features/settings/components/NotificationsCard'
import { translate } from '@/shared/utils/i18n'

const { Title } = Typography

export default function PreferencesTab() {
  const { mode, toggle } = useTheme()
  const { t, initialLoading, loading, settings, setSettings, save, reset, isDirty } = useUserSettings()

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gap: 16 }}>
      <Title level={3} style={{ marginBottom: 0 }}>
        {t('settings.preferences') || translate('settings.preferences')}
      </Title>

      <AppearanceCard
        t={t}
        mode={mode}
        toggleTheme={toggle}
        value={settings.appearance}
        onChange={v => setSettings(s => ({ ...s, appearance: v }))}
      />

      <NotificationsCard
        title={t('settings.notifications')}
        value={settings.notifications}
        onChange={v => setSettings(s => ({ ...s, notifications: v }))}
      />

      {/* 底部操作 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button onClick={reset} disabled={loading || !isDirty}>
          {t('app.reset')}
        </Button>
        <Button type="primary" onClick={save} loading={loading} disabled={!isDirty} icon={<Save size={16} />}>
          {loading ? t('settings.saving') : t('settings.save')}
        </Button>
      </div>
    </div>
  )
}
