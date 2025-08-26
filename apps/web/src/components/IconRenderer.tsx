// IconRenderer.tsx
import React from 'react'
import * as Lucide from 'lucide-react'
import * as AntdIcons from '@ant-design/icons'

// 1) 可选：别名表（把数据库里常见/旧名映射到真实组件名）
const alias: Record<string, { source: 'lucide' | 'antd' | 'emoji'; name: string }> = {
  dashboard: { source: 'lucide', name: 'LayoutDashboard' },
  gauge: { source: 'lucide', name: 'Gauge' },
  setting: { source: 'lucide', name: 'Settings' },
  settings: { source: 'lucide', name: 'Settings' },
  bookopen: { source: 'lucide', name: 'BookOpen' },
  'book-open': { source: 'lucide', name: 'BookOpen' },
  users: { source: 'lucide', name: 'Users' },
  user: { source: 'lucide', name: 'User' },
  questions: { source: 'lucide', name: 'HelpCircle' },
  'question-circle': { source: 'lucide', name: 'HelpCircle' },
  analytics: { source: 'lucide', name: 'BarChart3' },
  'bar-chart': { source: 'lucide', name: 'BarChart3' },
  exams: { source: 'lucide', name: 'ClipboardCheck' },
  exam: { source: 'lucide', name: 'ClipboardCheck' },
  results: { source: 'lucide', name: 'Trophy' },
  trophy: { source: 'lucide', name: 'Trophy' },
  menu: { source: 'lucide', name: 'List' },
  menus: { source: 'lucide', name: 'List' },
  calendar: { source: 'lucide', name: 'Calendar' },
  tasks: { source: 'lucide', name: 'Timer' },
}

// 2) 简单判断字符串是否是 emoji
const isEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s)

// 3) 主渲染器：支持 emoji / lucide / antd / url / 自动侦测
export function IconRenderer({
  icon, // 数据库存的值：如 'lucide:Gauge' | 'antd:SettingOutlined' | 'emoji:📊' | 'url:/icons/x.svg' | 'Gauge' | 'Setting' | '📊'
  size = 18,
  className,
}: {
  icon?: string | null
  size?: number
  className?: string
}) {
  // 默认占位
  const Fallback = ((Lucide as any)['HelpCircle'] as React.FC<any>) || (() => <span>?</span>)
  if (!icon || icon.trim() === '') return <Fallback size={size} className={className} />

  const raw = icon.trim()

  // 3.1 标准形式：source:name
  const colon = raw.indexOf(':')
  if (colon > 0) {
    const source = raw.slice(0, colon).toLowerCase()
    const name = raw.slice(colon + 1)

    if (source === 'emoji')
      return (
        <span style={{ fontSize: size }} className={className}>
          {name}
        </span>
      )
    if (source === 'url') return <img src={name} width={size} height={size} className={className} alt="" />

    if (source === 'lucide') {
      const Comp = (Lucide as any)[name]
      return Comp ? <Comp size={size} className={className} /> : <Fallback size={size} className={className} />
    }

    if (source === 'antd') {
      const Comp = (AntdIcons as any)[name]
      return Comp ? (
        <Comp style={{ fontSize: size }} className={className} />
      ) : (
        <Fallback size={size} className={className} />
      )
    }
  }

  // 3.2 兼容历史值：纯 emoji / 别名 / 组件名自动匹配
  if (isEmoji(raw))
    return (
      <span style={{ fontSize: size }} className={className}>
        {raw}
      </span>
    )

  const key = raw.toLowerCase().replace(/[\s_-]+/g, '')
  const al = alias[key]
  if (al) {
    if (al.source === 'emoji')
      return (
        <span style={{ fontSize: size }} className={className}>
          {al.name}
        </span>
      )
    if (al.source === 'lucide') {
      const Comp = (Lucide as any)[al.name]
      return Comp ? <Comp size={size} className={className} /> : <Fallback size={size} className={className} />
    }
    if (al.source === 'antd') {
      const Comp = (AntdIcons as any)[al.name]
      return Comp ? (
        <Comp style={{ fontSize: size }} className={className} />
      ) : (
        <Fallback size={size} className={className} />
      )
    }
  }

  // Lucide: 直接把字符串当组件名试试（你的库里有 'Gauge' / 'Settings' 这类）
  const LucideComp = (Lucide as any)[raw]
  if (LucideComp) return <LucideComp size={size} className={className} />

  // AntD: 直接把字符串当组件名试试（如 'SettingOutlined'）
  const AntdComp = (AntdIcons as any)[raw]
  if (AntdComp) return <AntdComp style={{ fontSize: size }} className={className} />

  // 兜底
  return <Fallback size={size} className={className} />
}
