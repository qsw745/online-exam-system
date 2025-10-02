// app/providers/AntdThemeProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { App as AntdApp, ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'

type Mode = 'light' | 'dark'
type ThemeCtx = { mode: Mode; toggle: () => void; setMode: (m: Mode) => void }

const ThemeContext = createContext<ThemeCtx | null>(null)
const STORAGE_KEY = 'app-theme-mode'

function detectInitialMode(): Mode {
  try {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as Mode | null
    if (saved === 'light' || saved === 'dark') return saved
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {}
  return 'light'
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <AntdThemeProvider>')
  return ctx
}

export const AntdThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setMode] = useState<Mode>(detectInitialMode)

  // 语言（驱动 antd locale）
  const [lang, setLang] = useState<string>(() => {
    try {
      return localStorage.getItem('language') || 'zh-CN'
    } catch {
      return 'zh-CN'
    }
  })

  useEffect(() => {
    const onLang = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      setLang(detail || localStorage.getItem('language') || 'zh-CN')
    }
    window.addEventListener('app-language-changed', onLang as EventListener)
    return () => window.removeEventListener('app-language-changed', onLang as EventListener)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  const toggle = () => setMode(p => (p === 'dark' ? 'light' : 'dark'))

  // 统一抬高全局弹层(Modal/Drawer/Dropdown/Tooltip/Select等)的基础 z-index
  // 你的侧栏≈1100/1200、头部≈1000、标签栏≈999~1200；设到 3500 足够压住它们
  const POPUP_Z = 3500

  const themeConfig: ThemeConfig = useMemo(
    () => ({
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      cssVar: { key: 'app' },
      token: {
        colorPrimary: '#3b82f6',
        borderRadius: 8,
        fontSize: 14,
        controlHeight: 36,
        zIndexPopupBase: POPUP_Z, // ★ 新增：全局弹层基准层级
      },
      components: {
        Layout: {
          headerBg: mode === 'dark' ? '#0f172a' : '#0B1220',
          headerColor: mode === 'dark' ? '#e2e8f0' : '#ffffff',
          siderBg: mode === 'dark' ? '#0b1220' : '#ffffff',
          bodyBg: mode === 'dark' ? '#0b1220' : '#f5f7fb',
          headerPadding: '0 16px',
        },
        Menu: {
          itemSelectedColor: mode === 'dark' ? '#e2e8f0' : '#0b1220',
          itemSelectedBg: mode === 'dark' ? 'rgba(59,130,246,.25)' : 'rgba(59,130,246,.12)',
          itemActiveBg: mode === 'dark' ? 'rgba(59,130,246,.18)' : 'rgba(59,130,246,.08)',
          itemBorderRadius: 8,
        },
        Button: {
          controlHeight: 36,
          colorPrimary: '#3b82f6',
          colorPrimaryHover: '#2563eb',
          colorPrimaryActive: '#1d4ed8',
          borderRadius: 8,
        },
        Card: { borderRadiusLG: 12, paddingLG: 20, colorBgContainer: mode === 'dark' ? '#111827' : undefined },
        Input: { borderRadius: 8, activeShadow: '0 0 0 2px rgba(59,130,246,.2)' },
        Select: { borderRadius: 8 },
        Table: {
          rowHoverBg: mode === 'dark' ? 'rgba(59,130,246,.06)' : 'rgba(59,130,246,.04)',
          headerBg: mode === 'dark' ? '#0f172a' : undefined,
          headerColor: mode === 'dark' ? '#cbd5e1' : undefined,
        },
        Modal: { borderRadiusLG: 12, padding: 16, colorBgMask: 'rgba(2,6,23,.55)' },
        Tag: { defaultBg: mode === 'dark' ? '#0f172a' : undefined },
        Tooltip: { colorBgSpotlight: mode === 'dark' ? '#111827' : undefined },
        Tabs: { itemActiveColor: mode === 'dark' ? '#e2e8f0' : undefined, inkBarColor: '#3b82f6' },
      },
    }),
    [mode]
  )

  const antdLocale = lang === 'en-US' ? enUS : zhCN

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode }}>
      <ConfigProvider locale={antdLocale} theme={themeConfig}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export const ThemeProvider = AntdThemeProvider
