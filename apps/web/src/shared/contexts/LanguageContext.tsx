import importedTranslations from '@app/i18n'
import { settings } from '@shared/api/http'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

type Language = 'zh-CN' | 'en-US'

interface Translations {
  [key: string]: {
    [key: string]: string
  }
}

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
  translations: Translations
}

// 使用导入的翻译文件

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// 自定义钩子，用于在组件中使用语言上下文
const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export { useLanguage }

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [language, setLanguageState] = useState<Language>(() => {
    // 从本地存储获取语言设置，默认为中文
    const storedLanguage = localStorage.getItem('language')
    return (storedLanguage as Language) || 'zh-CN'
  })

  const [translations, setTranslations] = useState<Translations>(importedTranslations)

  // 加载用户设置中的语言
  useEffect(() => {
    // 只有在用户已登录时才尝试获取设置
    if (user?.id && !isNaN(Number(user.id))) {
      const loadLanguageSetting = async () => {
        try {
          const res = (await settings.get()) as any
          const data = res?.data ?? res
          const lang = data?.appearance?.language as Language | undefined
          if (lang) setLanguageState(lang)
        } catch (error) {
          console.error('加载语言设置错误:', error)
        }
      }

      loadLanguageSetting()
    }
  }, [user])

  // 当语言变化时，更新本地存储
  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  // 设置语言并保存到用户设置
  const setLanguage = async (newLanguage: Language) => {
    setLanguageState(newLanguage)

    // 更新本地存储
    localStorage.setItem('language', newLanguage)

    // 只有在用户已登录且ID有效时才尝试保存设置到服务器
    if (user?.id && !isNaN(Number(user.id))) {
      try {
        // 获取当前设置
        const res = (await settings.get()) as any
        const data = res?.data ?? res
        // 更新语言设置
        await settings.save({
          ...(data ?? {}),
          appearance: {
            ...(data?.appearance ?? {}),
            language: newLanguage,
          },
        })
      } catch (error) {
        console.error('保存语言设置错误:', error)
      }
    }
  }

  // 翻译函数
  const t = (key: string): string => {
    return translations[language]?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translations }}>{children}</LanguageContext.Provider>
  )
}
