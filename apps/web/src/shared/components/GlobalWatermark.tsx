import React from 'react'
import { Watermark } from 'antd'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/contexts/AuthContext'
import { formatDateTime } from '@/shared/utils/datetime'
import {
  getWatermarkConfig,
  onWatermarkConfigChange,
  resolveWatermarkContent,
  watermarkFontColor,
  type WatermarkConfig,
} from '@/shared/utils/watermark'

const TIME_REFRESH_MS = 60_000
const EXAM_PATH_RE = /^\/exam(\/|$)/

/** 全局水印：配置由后台系统设置下发；scope=exam 时仅考试页生效 */
export default function GlobalWatermark({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const [config, setConfig] = React.useState<WatermarkConfig>(getWatermarkConfig)
  const [, setTick] = React.useState(0)

  React.useEffect(() => onWatermarkConfigChange(setConfig), [])

  // 内容含 {time} 时每分钟刷新一次，保证截图能对应到时间
  const hasTime = config.enabled && config.content.includes('{time}')
  React.useEffect(() => {
    if (!hasTime) return
    const id = window.setInterval(() => setTick(t => t + 1), TIME_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [hasTime])

  const active = config.enabled && (config.scope === 'all' || EXAM_PATH_RE.test(location.pathname))
  if (!active) return <>{children}</>

  const lines = resolveWatermarkContent(config, { name: user?.nickname, email: user?.email }, () =>
    formatDateTime(new Date())
  )
  if (!lines.length) return <>{children}</>

  return (
    <Watermark
      content={lines}
      rotate={config.rotate}
      gap={[config.gap, config.gap]}
      font={{ fontSize: config.fontSize, color: watermarkFontColor(config) }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </Watermark>
  )
}
