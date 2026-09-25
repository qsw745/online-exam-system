// features/settings/pages/SettingsPage.tsx
import { Alert, Button, Space, Spin, Typography } from 'antd'
import { Save } from 'lucide-react'
import React from 'react'
import { useTheme } from '@/app/providers/AntdThemeProvider'
import { useUserSettings } from '../hooks/useUserSettings'
import { NotificationsCard } from '../components/NotificationsCard'
import { PrivacyCard } from '../components/PrivacyCard'
import { AppearanceCard } from '../components/AppearanceCard'

const { Title } = Typography

export default function SettingsPage() {
  const { mode, toggle } = useTheme()
  const { t, initialLoading, loading, settings, setSettings, save, reset, isDirty, error, saveError, retry } = useUserSettings()

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) return <Alert type="error" showIcon message="设置暂时无法显示" description={error}
    action={<Button onClick={retry}>重试</Button>} />

  return (
    <div className="student-settings-page">
      <Title level={2} style={{ marginBottom: 20 }}>
        {t('settings.title')}
      </Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <NotificationsCard
          title={t('settings.notifications')}
          value={settings.notifications}
          onChange={v => setSettings(s => ({ ...s, notifications: v }))}
        />
        <PrivacyCard t={t} value={settings.privacy} onChange={v => setSettings(s => ({ ...s, privacy: v }))} />
        <AppearanceCard
          t={t}
          mode={mode}
          toggleTheme={toggle}
          value={settings.appearance}
          onChange={v => setSettings(s => ({ ...s, appearance: v }))}
        />
      </Space>

      {saveError && <Alert type="error" showIcon message={saveError} description="修改内容已保留，请重试保存。" style={{ marginTop: 16 }} />}
      {/* 底部操作 */}
      <div className="student-settings-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
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
