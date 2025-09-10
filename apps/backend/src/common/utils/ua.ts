import UAParser from 'ua-parser-js'

export type ClientInfo = {
  device: string
  os: string
  browser: string
  type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown'
  label: string
}

function classifyType(p: UAParser.IResult): ClientInfo['type'] {
  const devType = (p.device.type || '').toLowerCase()
  if (devType === 'mobile') return 'mobile'
  if (devType === 'tablet') return 'tablet'
  if (devType === 'smarttv') return 'desktop'
  if (devType === 'console') return 'desktop'
  if (devType === 'wearable') return 'mobile'
  if (devType === 'embedded') return 'unknown'
  // 没识别设备类型时，用引擎/UA做兜底
  const ua = (p.ua || '').toLowerCase()
  if (/bot|spider|crawler/.test(ua)) return 'bot'
  return 'desktop'
}

export function parseUA(ua?: string | null): ClientInfo {
  const parser = new UAParser(ua || '')
  const r = parser.getResult()
  const brand = r.device.vendor ? r.device.vendor : ''
  const model = r.device.model ? r.device.model : ''
  const device = [brand, model].filter(Boolean).join(' ') || (r.device.type ? r.device.type : 'Unknown Device')

  const os = [r.os.name, r.os.version].filter(Boolean).join(' ') || 'Unknown OS'
  const browser =
    [r.browser.name, r.browser.version?.split('.').slice(0, 2).join('.')].filter(Boolean).join(' ') || 'Unknown Browser'
  const type = classifyType(r)

  // 终端展示标签（简洁）
  const labelParts: string[] = []
  // 手机/平板优先展示具体设备名
  if (type === 'mobile' || type === 'tablet') {
    labelParts.push(device)
  } else {
    // PC/其他直接展示 OS
    labelParts.push(os)
  }
  labelParts.push(browser)
  const label = labelParts.join(' · ')

  return { device, os, browser, type, label }
}
