import dayjs from 'dayjs'

/** 全局默认日期时间格式（dayjs 模板） */
export const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const DATETIME_FORMAT_STORAGE_KEY = 'systemDateTimeFormat'
const DATETIME_FORMAT_EVENT = 'app-datetime-format-changed'

/** 日期时间格式预设分组（后台可选），format 为 dayjs 模板；标签由界面用当前时间实时预览生成 */
export const DATETIME_FORMAT_GROUPS: Array<{ key: 'seconds' | 'minutes' | 'hour12' | 'dateOnly'; formats: string[] }> = [
  {
    key: 'seconds',
    formats: ['YYYY-MM-DD HH:mm:ss', 'YYYY/MM/DD HH:mm:ss', 'YYYY.MM.DD HH:mm:ss', 'YYYY年MM月DD日 HH:mm:ss'],
  },
  {
    key: 'minutes',
    formats: [
      'YYYY-MM-DD HH:mm',
      'YYYY/MM/DD HH:mm',
      'YYYY.MM.DD HH:mm',
      'YYYY年MM月DD日 HH:mm',
      'MM/DD/YYYY HH:mm',
      'DD/MM/YYYY HH:mm',
    ],
  },
  {
    key: 'hour12',
    formats: ['YYYY-MM-DD hh:mm:ss A', 'YYYY-MM-DD hh:mm A'],
  },
  {
    key: 'dateOnly',
    formats: ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD', 'YYYY年MM月DD日', 'MM/DD/YYYY', 'DD/MM/YYYY'],
  },
]

// 模块级当前格式：应用启动时由公开设置注入，管理员保存后即时刷新
let currentFormat = (() => {
  try {
    const stored = localStorage.getItem(DATETIME_FORMAT_STORAGE_KEY)
    return stored?.trim() || DEFAULT_DATETIME_FORMAT
  } catch {
    return DEFAULT_DATETIME_FORMAT
  }
})()

export function setDateTimeFormat(fmt?: string | null): void {
  const next = typeof fmt === 'string' && fmt.trim() ? fmt.trim() : DEFAULT_DATETIME_FORMAT
  currentFormat = next
  try {
    localStorage.setItem(DATETIME_FORMAT_STORAGE_KEY, next)
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(DATETIME_FORMAT_EVENT, { detail: next }))
  } catch {}
}

export function getDateTimeFormat(): string {
  try {
    const stored = localStorage.getItem(DATETIME_FORMAT_STORAGE_KEY)
    if (stored?.trim()) currentFormat = stored.trim()
  } catch {}
  return currentFormat
}

/** 统一日期时间渲染：无效/空值返回空串，解析失败原样返回，避免抛错 */
export function formatDateTime(value?: string | number | Date | null, fmt?: string): string {
  if (value == null || value === '') return ''
  // MySQL 时间戳可能是 'YYYY-MM-DD HH:mm:ss'，Safari 需转成 ISO 风格
  const raw = typeof value === 'string' ? value.replace(' ', 'T') : value
  const d = dayjs(raw)
  if (!d.isValid()) return String(value)
  return d.format(fmt || getDateTimeFormat())
}

/** 仅日期部分（沿用全局格式的日期段，或显式传入） */
export function formatDate(value?: string | number | Date | null, fmt = 'YYYY-MM-DD'): string {
  return formatDateTime(value, fmt)
}

export function onDateTimeFormatChange(listener: (format: string) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail || getDateTimeFormat())
  window.addEventListener(DATETIME_FORMAT_EVENT, handler as EventListener)
  return () => window.removeEventListener(DATETIME_FORMAT_EVENT, handler as EventListener)
}
