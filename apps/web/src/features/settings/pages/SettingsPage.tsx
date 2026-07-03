// src/features/settings/pages/SettingsPage.tsx
import React, { useMemo, useState, Suspense } from 'react'
import { Card, Menu } from 'antd'
import { useNavigate } from 'react-router-dom'
import { User as UserIcon, Settings as SettingsIcon, ShieldCheck, BookUser, ChevronLeft } from 'lucide-react'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { withAppAssetPath } from '@/shared/router/basePath'
import { translate } from '@/shared/utils/i18n'

// 懒加载四个 Tab（仍然按需加载，首屏更轻）
const ProfileTab = React.lazy(() => import('./tabs/ProfileTab'))
const PreferencesTab = React.lazy(() => import('./tabs/PreferencesTab'))
const SecurityTab = React.lazy(() => import('./tabs/SecurityTab'))
const AccountTab = React.lazy(() => import('./tabs/AccountTab'))

type TabKey = 'profile' | 'preferences' | 'security' | 'account'

export default function SettingsPage() {
  const nav = useNavigate()
  const [active, setActive] = useState<TabKey>('profile') // ✅ 本地状态控制
  const menuItems = [
    { key: 'profile', icon: <UserIcon size={16} />, label: translate('nav.profile') },
    { key: 'preferences', icon: <SettingsIcon size={16} />, label: translate('settings.preferences') },
    { key: 'security', icon: <ShieldCheck size={16} />, label: translate('auto.eb7770fabe') },
    { key: 'account', icon: <BookUser size={16} />, label: translate('settings.account') },
  ] as const

  const goBack = () => {
    if (window.history.length > 1) nav(-1)
    else nav('/dashboard')
  }

  const Content = useMemo(() => {
    switch (active) {
      case 'profile':
        return <ProfileTab />
      case 'preferences':
        return <PreferencesTab />
      case 'security':
        return <SecurityTab />
      case 'account':
        return <AccountTab />
      default:
        return null
    }
  }, [active])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 返回按钮 */}
      <button
        type="button"
        onClick={goBack}
        aria-label={translate('app.back')}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          border: 'none',
          background: 'transparent',
          color: 'var(--app-colorTextSecondary, #6b7280)',
          cursor: 'pointer',
          borderRadius: 8,
        }}
        onMouseEnter={e =>
          ((e.currentTarget.style as any).backgroundColor =
            'var(--app-colorFillTertiary, rgba(0,0,0,.04))')
        }
        onMouseLeave={e => ((e.currentTarget.style as any).backgroundColor = 'transparent')}
      >
        <ChevronLeft size={18} />
        <span style={{ fontSize: 16 }}>{translate('app.back')}</span>
      </button>

      {/* 主体两栏布局 */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* 左侧导航卡片 */}
        <Card style={{ padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 8px' }}>
            <img
              src={withAppAssetPath('/brand-logo.svg')}
              width={32}
              height={32}
              style={{ borderRadius: 8, objectFit: 'cover' }}
            />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 600 }}>{translate('header.account_settings')}</div>
              <div style={{ fontSize: 12, color: 'var(--app-colorTextTertiary,#999)' }}>{translate('auto.204e49ad8c')}</div>
            </div>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[active]}
            items={menuItems as any}
            onClick={({ key }) => setActive(key as TabKey)}   
            style={{ borderInlineEnd: 'none', padding: '8px 8px 16px' }}
          />
        </Card>

        {/* 右侧内容区域：组件切换 */}
        <Card>
          <Suspense fallback={<LoadingSpinner center="page" text={translate('auto.300ee3dee4')} />}>
            {Content}
          </Suspense>
        </Card>
      </div>
    </div>
  )
}
