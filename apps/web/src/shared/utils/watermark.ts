// 全局水印配置：启动时由公开设置注入，管理员保存后即时刷新（机制同 datetime.ts）

export interface WatermarkConfig {
  enabled: boolean
  scope: 'all' | 'exam'
  /** 内容模板：支持 {name} {email} {time} 占位符，| 分隔多行 */
  content: string
  opacity: number
  fontSize: number
  rotate: number
  gap: number
  color: string
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  scope: 'all',
  content: '{name} {time}',
  opacity: 0.12,
  fontSize: 14,
  rotate: -22,
  gap: 100,
  color: '#000000',
}

const STORAGE_KEY = 'systemWatermarkConfig'
const EVENT = 'app-watermark-config-changed'

const clamp = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback

/** 从任意来源（公开设置/表单值）归一化出配置 */
export function normalizeWatermarkConfig(raw?: Record<string, unknown> | null): WatermarkConfig {
  const d = DEFAULT_WATERMARK_CONFIG
  const r = (raw ?? {}) as Record<string, any>
  return {
    enabled: !!r.watermarkEnabled,
    scope: r.watermarkScope === 'exam' ? 'exam' : 'all',
    content: typeof r.watermarkContent === 'string' && r.watermarkContent.trim() ? r.watermarkContent : d.content,
    opacity: clamp(Number(r.watermarkOpacity), 0.02, 1, d.opacity),
    fontSize: clamp(Number(r.watermarkFontSize), 10, 48, d.fontSize),
    rotate: clamp(Number(r.watermarkRotate), -90, 90, d.rotate),
    gap: clamp(Number(r.watermarkGap), 20, 400, d.gap),
    color: /^#[0-9a-fA-F]{6}$/.test(String(r.watermarkColor)) ? String(r.watermarkColor) : d.color,
  }
}

let currentConfig: WatermarkConfig = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...DEFAULT_WATERMARK_CONFIG, ...JSON.parse(stored) } : DEFAULT_WATERMARK_CONFIG
  } catch {
    return DEFAULT_WATERMARK_CONFIG
  }
})()

export function getWatermarkConfig(): WatermarkConfig {
  return currentConfig
}

export function setWatermarkConfig(raw?: Record<string, unknown> | null): void {
  currentConfig = normalizeWatermarkConfig(raw)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig))
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: currentConfig }))
  } catch {}
}

export function onWatermarkConfigChange(listener: (config: WatermarkConfig) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<WatermarkConfig>).detail || currentConfig)
  window.addEventListener(EVENT, handler as EventListener)
  return () => window.removeEventListener(EVENT, handler as EventListener)
}

/** #RRGGBB + 透明度 → rgba() */
export function watermarkFontColor(config: WatermarkConfig): string {
  const hex = config.color.slice(1)
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${config.opacity})`
}

/** 解析内容模板：替换 {name}/{email}/{time} 占位符，| 分隔多行 */
export function resolveWatermarkContent(
  config: WatermarkConfig,
  user: { name?: string | null; username?: string | null; email?: string | null } | null,
  formatTime: () => string
): string[] {
  const text = config.content
    .replaceAll('{name}', user?.name || user?.username || user?.email || '')
    .replaceAll('{email}', user?.email || '')
    .replaceAll('{time}', formatTime())
  return text
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
}
