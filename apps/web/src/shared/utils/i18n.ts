import translations from '@/app/i18n'

type Lang = 'zh-CN' | 'en-US'

/** 读取当前语言（与 LanguageContext 一致，走 localStorage），供非组件代码使用 */
export function getLang(): Lang {
  try {
    const l = localStorage.getItem('language')
    return l === 'en-US' ? 'en-US' : 'zh-CN'
  } catch {
    return 'zh-CN'
  }
}

/**
 * 模块级翻译（无 hook）——用于工具函数、常量、模块级函数等无法调用 useLanguage 的场景。
 * 语义与 LanguageContext.t 一致：命中→fallback→zh 默认→key。
 * 注意：非响应式，切换语言后需组件重渲染才反映（工具函数在渲染期调用即可拿到最新）。
 */
export function translate(key: string, fallback?: string): string {
  const lang = getLang()
  const dict = translations as unknown as Record<string, Record<string, string>>
  const v = dict[lang]?.[key]
  if (typeof v === 'string') return v
  if (fallback) return fallback
  const zh = dict['zh-CN']?.[key]
  if (lang !== 'zh-CN' && typeof zh === 'string') return zh
  return key
}
