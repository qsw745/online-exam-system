// src/shared/contexts/LanguageContext.tsx
import importedTranslations from '@/app/i18n'
import { api, settingsApi } from '@/shared/api/http' // ← 引入 api 以做回退
import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

type Language = 'zh-CN' | 'en-US'

interface Translations {
  [key: string]: { [key: string]: string }
}

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
  translations: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()

  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language')
    return (stored as Language) || 'zh-CN'
  })

  const [translations] = useState<Translations>(importedTranslations)

  // 载入用户服务端设置
  useEffect(() => {
    if (user?.id && !isNaN(Number(user.id))) {
      ;(async () => {
        try {
          const res: any =
            typeof settingsApi?.get === 'function' ? await settingsApi.get() : await api.get?.('/settings')
          const data = res?.data ?? res
          const lang = data?.appearance?.language as Language | undefined
          if (lang) setLanguageState(lang)
        } catch (e) {
          console.error('加载语言设置错误:', e)
        }
      })()
    }
  }, [user])

  // 同步到本地 & <html lang>
  useEffect(() => {
    localStorage.setItem('language', language)
    document.documentElement.lang = language
  }, [language])

  // 统一的保存函数（自动探测 settingsApi 的可用方法；不影响本地即时切换）
  const persistLanguage = async (newLanguage: Language) => {
    if (!(user?.id && !isNaN(Number(user.id)))) return

    try {
      const getFn =
        (settingsApi && typeof settingsApi.get === 'function' && settingsApi.get.bind(settingsApi)) ||
        (api.get ? api.get.bind(api, '/settings') : null)

      const res: any = getFn ? await getFn() : {}
      const data = res?.data ?? res ?? {}

      const payload = {
        ...(data || {}),
        appearance: { ...(data?.appearance ?? {}), language: newLanguage },
      }

      const candidates: Array<((body: any) => Promise<any>) | undefined> = [
        settingsApi?.save?.bind(settingsApi),
        settingsApi?.update?.bind(settingsApi),
        settingsApi?.set?.bind(settingsApi),
        settingsApi?.put?.bind(settingsApi),
        api.put ? api.put.bind(api, '/settings') : undefined,
        api.post ? api.post.bind(api, '/settings') : undefined,
      ]

      let saved = false
      for (const fn of candidates) {
        if (!fn) continue
        try {
          await fn(payload)
          saved = true
          break
        } catch {
          // 尝试下一个候选
        }
      }
      if (!saved) {
        console.warn('未找到可用的 settings 保存方法，已仅在本地切换语言')
      }
    } catch (error) {
      console.error('保存语言设置错误:', error)
    }
  }

  // 对外暴露的切换：先本地更新，后异步落库
  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage) // 立即触发重渲染
    localStorage.setItem('language', newLanguage)
    void persistLanguage(newLanguage) // 异步保存；失败不影响本地体验
  }

  const t = (key: string): string => translations[language]?.[key] || key

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translations }}>{children}</LanguageContext.Provider>
  )
}
