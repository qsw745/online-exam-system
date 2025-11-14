// src/shared/contexts/LanguageContext.tsx
import importedTranslations from '@/app/i18n'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

type Language = 'zh-CN' | 'en-US'

interface Translations {
  [key: string]: { [key: string]: string }
}

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, fallback?: string) => string
  translations: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

/**
 * 设计要点：
 * 1) 不进行任何网络请求；完全本地化（state + localStorage + <html lang>）。
 * 2) 切换语言时发出 "app-language-changed" 事件，AntdThemeProvider 等监听者即可更新，不再触发接口。
 * 3) 若用户已登录，优先读取本地缓存的 userSettings（由“个人偏好保存”时写入），不访问服务端。
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()

  // 初始语言：localStorage → 默认 zh-CN
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('language') as Language | null
      return stored === 'zh-CN' || stored === 'en-US' ? stored : 'zh-CN'
    } catch {
      return 'zh-CN'
    }
  })

  const [translations] = useState<Translations>(importedTranslations)

  // 登录后尝试从本地 userSettings 中恢复（不发请求）
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem('userSettings')
      if (!raw) return
      const parsed = JSON.parse(raw)
      const lang = parsed?.appearance?.language as Language | undefined
      if (lang && lang !== language) {
        setLanguageState(lang)
      }
    } catch {
      /* ignore */
    }
    // 仅在 user.id 变化时尝试一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // 同步到本地 & <html lang> & 广播事件（不做任何网络调用）
  useEffect(() => {
    try {
      localStorage.setItem('language', language)
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-language-changed', { detail: language }))
    }
  }, [language])

  // 对外切换函数：只更新本地状态（服务端持久化留给“偏好设置保存”去做）
  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    // 其他同步动作由上面的 useEffect 统一处理
  }

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const localized = translations[language]?.[key]
      if (typeof localized === 'string') return localized
      if (fallback) return fallback
      const zhDefault = translations['zh-CN']?.[key]
      if (language !== 'zh-CN' && typeof zhDefault === 'string') return zhDefault
      return key
    },
    [language, translations]
  )

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translations }}>{children}</LanguageContext.Provider>
  )
}
