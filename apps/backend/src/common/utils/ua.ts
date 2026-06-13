import { UAParser } from 'ua-parser-js'

export type ClientInfo = {
  device: string
  os: string
  browser: string
  type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
  label: string
}

export function parseUA(ua?: string | null): ClientInfo {
  const parser = new UAParser(ua || '')
  const r = parser.getResult() as any

  const uaLower = String(r.ua || ua || '').toLowerCase()
  const isBot = /bot|spider|crawler|bingbot|googlebot|yandex|headless|phantom|scrapy|python-requests|curl|wget/.test(
    uaLower
  )

  const deviceName =
    [r?.device?.vendor, r?.device?.model].filter(Boolean).join(' ') || r?.device?.type || 'Unknown Device'

  const os = [r?.os?.name, r?.os?.version].filter(Boolean).join(' ') || 'Unknown OS'
  const browser =
    [r?.browser?.name, r?.browser?.version?.split('.').slice(0, 2).join('.')].filter(Boolean).join(' ') ||
    'Unknown Browser'

  let type: ClientInfo['type'] = 'desktop'
  if (isBot) type = 'bot'
  else if (r?.device?.type === 'mobile') type = 'mobile'
  else if (r?.device?.type === 'tablet') type = 'tablet'
  else if (!r?.device?.type) type = 'desktop'

  const label =
    type === 'mobile' || type === 'tablet'
      ? [deviceName, browser].filter(Boolean).join(' · ')
      : [os, browser].filter(Boolean).join(' · ')

  return { device: deviceName, os, browser, type, label }
}
