import { useEffect } from 'react'
import { useLayout } from '@/shared/contexts/LayoutContext'

/** 把侧栏/头部/标签高度写成 CSS 变量，所有布局统一吃变量 */
export default function LayoutOffsetVars() {
  const { mode, collapsed, showTabs } = useLayout()
  // side/mix 有侧栏，top 没有
  const sider = mode === 'side' || mode === 'mix' ? (collapsed ? 64 : 240) : 0
  const header = 48
  const tabs = showTabs ? 40 : 0

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sider-width', `${sider}px`)
    root.style.setProperty('--header-height', `${header}px`)
    root.style.setProperty('--tabs-height', `${tabs}px`)
  }, [sider, header, tabs])

  return null
}
