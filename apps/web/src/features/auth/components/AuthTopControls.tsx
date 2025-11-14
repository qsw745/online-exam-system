import React from 'react'
import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { Languages, Moon, Sun } from 'lucide-react'

import { useTheme } from '@/app/providers/AntdThemeProvider'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type Props = {
  className?: string
  style?: React.CSSProperties
}

export const AuthTopControls: React.FC<Props> = ({ className, style }) => {
  const { mode, toggle } = useTheme()
  const { language, setLanguage, t } = useLanguage()

  const isDark = mode === 'dark'

  const langMenuItems: MenuProps['items'] = [
    {
      key: 'zh-CN',
      label: (
        <span style={{ fontWeight: language === 'zh-CN' ? 600 : 400 }}>
          {language === 'zh-CN' ? '✓ ' : ''}
          {t('language.zh-CN')}
        </span>
      ),
    },
    {
      key: 'en-US',
      label: (
        <span style={{ fontWeight: language === 'en-US' ? 600 : 400 }}>
          {language === 'en-US' ? '✓ ' : ''}
          {t('language.en-US')}
        </span>
      ),
    },
  ]

  const pillStyle: React.CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'}`,
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)',
    color: isDark ? '#e2e8f0' : '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,.35)' : '0 8px 20px rgba(15,23,42,.08)',
    backdropFilter: 'blur(8px)',
  }

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: langMenuItems,
          onClick: ({ key }) => setLanguage(key as 'zh-CN' | 'en-US'),
        }}
      >
        <Button style={pillStyle} icon={<Languages size={16} />} type="text">
          {language === 'zh-CN' ? t('language.zh-CN') : t('language.en-US')}
        </Button>
      </Dropdown>

      <Button
        style={pillStyle}
        icon={isDark ? <Sun size={16} /> : <Moon size={16} />}
        type="text"
        onClick={toggle}
      >
        {isDark ? t('theme.light') : t('theme.dark')}
      </Button>
    </div>
  )
}
