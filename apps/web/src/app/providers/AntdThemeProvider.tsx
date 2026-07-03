// app/providers/AntdThemeProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { App as AntdApp, ConfigProvider, Modal, theme as antdTheme, type ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { setDateTimeFormat } from '@/shared/utils/datetime'
import { setWatermarkConfig } from '@/shared/utils/watermark'

type Mode = 'light' | 'dark'
type ThemeCtx = { mode: Mode; toggle: () => void; setMode: (m: Mode) => void }

const ThemeContext = createContext<ThemeCtx | null>(null)
const STORAGE_KEY = 'app-theme-mode'
const STATIC_MODAL_METHODS = ['confirm', 'info', 'success', 'error', 'warning', 'warn'] as const
const originalStaticModalMethods = new Map<string, any>()

function resolveAntdLocale<T extends Record<string, any>>(locale: T): T {
  return ((locale as any).default || locale) as T
}

function patchStaticModalLocale(locale: typeof zhCN) {
  const resolvedLocale = resolveAntdLocale(locale as any)
  const modalLocale = resolvedLocale.Modal || {}
  const isZh = String(resolvedLocale.locale || '').toLowerCase().startsWith('zh')
  const okText = modalLocale.okText || (isZh ? '确定' : 'OK')
  const cancelText = modalLocale.cancelText || (isZh ? '取消' : 'Cancel')
  STATIC_MODAL_METHODS.forEach(method => {
    if (!originalStaticModalMethods.has(method)) {
      originalStaticModalMethods.set(method, (Modal as any)[method])
    }
    const original = originalStaticModalMethods.get(method)
    ;(Modal as any)[method] = (config: any = {}) =>
      original({
        okText,
        cancelText,
        ...config,
      })
  })
}

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

  // 启动时注入全局日期时间格式与水印配置（公开设置，无需登录）
  useEffect(() => {
    adminSettingsApi
      .getPublic()
      .then(s => {
        setDateTimeFormat((s as any)?.dateTimeFormat)
        setWatermarkConfig(s as any)
      })
      .catch(() => {})
  }, [])

  const toggle = () => setMode(p => (p === 'dark' ? 'light' : 'dark'))

  // 统一抬高全局弹层(Modal/Drawer/Dropdown/Tooltip/Select等)的基础 z-index
  // 你的侧栏≈1100/1200、头部≈1000、标签栏≈999~1200；设到 3500 足够压住它们
  const POPUP_Z = 3500

  const themeConfig: ThemeConfig = useMemo(
    () => {
      const baseTokens = {
        colorPrimary: '#3b82f6',
        borderRadius: 8,
        fontSize: 14,
        controlHeight: 36,
        zIndexPopupBase: POPUP_Z,
      }
      const lightTokens = {
        colorBgLayout: '#f5f7fb',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorText: '#111827',
        colorTextSecondary: '#475569',
        colorTextTertiary: '#94a3b8',
        colorBorder: '#e2e8f0',
        colorBorderSecondary: '#e2e8f0',
        colorSplit: '#e2e8f0',
      }
      const darkTokens = {
        colorBgLayout: '#050b16',
        colorBgContainer: '#0b1220',
        colorBgElevated: '#111827',
        colorText: '#e2e8f0',
        colorTextSecondary: '#94a3b8',
        colorTextTertiary: '#7c8aa5',
        colorBorder: '#1f2937',
        colorBorderSecondary: '#1e2533',
        colorSplit: '#1e2533',
      }
      return {
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: 'app' },
        token: {
          ...baseTokens,
          ...(mode === 'dark' ? darkTokens : lightTokens),
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
      }
    },
    [mode]
  )

  const antdLocale = resolveAntdLocale(lang === 'en-US' ? enUS : zhCN)

  useEffect(() => {
    patchStaticModalLocale(antdLocale)
  }, [antdLocale])

  useEffect(() => {
    ConfigProvider.config({
      holderRender: node => (
        <ConfigProvider locale={antdLocale} theme={themeConfig}>
          {node}
        </ConfigProvider>
      ),
    })
  }, [antdLocale, themeConfig])

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode }}>
      <ConfigProvider locale={antdLocale} theme={themeConfig}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export const ThemeProvider = AntdThemeProvider
