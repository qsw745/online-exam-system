import { useLayout } from '@/shared/contexts/LayoutContext'
import { useTabs } from '@/shared/contexts/TabsContext'
import { getTitle as getRegisteredTitle } from '@/shared/contexts/tabsTitleRegistry'
import type { MenuProps } from 'antd'
import { Dropdown } from 'antd'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelRightClose,
  RotateCw,
  Split,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './css/TabsBar.css'

const SCROLL_STEP = 260
const HOME_PATH = '/dashboard' // 仪表盘路径

export const TabsBar: React.FC = () => {
  const navigate = useNavigate()
  const { tabs, activeKey, closeTab, closeOthers, closeAll } = useTabs()
  const { showTabs, mode, collapsed } = useLayout()
  if (!showTabs) return null

  const hasSider = mode === 'side' || mode === 'mix'
  const siderOffset = hasSider ? (collapsed ? 64 : 240) : 0

  /* ---------- 全屏（可选） ---------- */
  const [fullscreen, setFullscreen] = useState(false)
  const toggleFullscreen = () => {
    setFullscreen(s => {
      const next = !s
      if (next) document.body.setAttribute('data-content-fullscreen', '1')
      else document.body.removeAttribute('data-content-fullscreen')
      return next
    })
  }

  /* ---------- 顶部更多菜单 ---------- */
  const activeIndex = useMemo(() => tabs.findIndex(t => t.key === activeKey), [tabs, activeKey])
  const leftKeys = useMemo(
    () =>
      activeIndex > 0
        ? tabs
            .slice(0, activeIndex)
            .filter(t => t.closable !== false)
            .map(t => t.key)
        : [],
    [tabs, activeIndex]
  )
  const rightKeys = useMemo(
    () =>
      activeIndex >= 0 && activeIndex < tabs.length - 1
        ? tabs
            .slice(activeIndex + 1)
            .filter(t => t.closable !== false)
            .map(t => t.key)
        : [],
    [tabs, activeIndex]
  )

  const globalMenuItems: MenuProps['items'] = useMemo(
    () => [
      { key: 'reload', icon: <RotateCw size={16} />, label: '重新加载' },
      { type: 'divider' as const },
      { key: 'close-current', icon: <X size={16} />, label: '关闭当前标签页' },
      {
        key: 'close-left',
        icon: <PanelLeftClose size={16} />,
        label: '关闭左侧标签页',
        disabled: leftKeys.length === 0,
      },
      {
        key: 'close-right',
        icon: <PanelRightClose size={16} />,
        label: '关闭右侧标签页',
        disabled: rightKeys.length === 0,
      },
      { type: 'divider' as const },
      { key: 'close-others', icon: <Split size={16} />, label: '关闭其他标签页' },
      { key: 'close-all', icon: <Minus size={16} />, label: '关闭全部标签页' },
      { type: 'divider' as const },
      {
        key: 'fullscreen',
        icon: fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />,
        label: fullscreen ? '内容区退出全屏' : '内容区全屏',
      },
    ],
    [leftKeys.length, rightKeys.length, fullscreen]
  )

  const onGlobalMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'reload':
        navigate(0)
        break
      case 'close-current':
        closeTab(activeKey)
        break
      case 'close-left':
        leftKeys.forEach(k => closeTab(k))
        break
      case 'close-right':
        rightKeys.forEach(k => closeTab(k))
        break
      case 'close-others':
        closeOthers(activeKey)
        break
      case 'close-all':
        closeAll()
        break
      case 'fullscreen':
        toggleFullscreen()
        break
    }
  }

  /* ---------- 展示数据 ---------- */
  const items = useMemo(
    () =>
      tabs.map(t => ({
        key: t.key,
        title: getRegisteredTitle(t.key) || t.title,
        closable: t.closable !== false,
      })),
    [tabs]
  )

  /* ---------- 滚动/箭头 ---------- */
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  const updateScrollState = () => {
    const wrap = wrapRef.current
    if (!wrap) return
    const overflow = wrap.scrollWidth - wrap.clientWidth > 1
    setOverflowing(overflow)
    setCanLeft(wrap.scrollLeft > 1)
    setCanRight(wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 1)
  }

  useEffect(() => {
    const wrap = wrapRef.current
    const list = listRef.current
    if (!wrap || !list) return

    const onScroll = () => updateScrollState()
    wrap.addEventListener('scroll', onScroll, { passive: true })

    const ro = new ResizeObserver(updateScrollState)
    ro.observe(wrap)
    ro.observe(list)

    requestAnimationFrame(() => {
      updateScrollState()
      requestAnimationFrame(updateScrollState)
      Promise.resolve().then(updateScrollState)
      setTimeout(updateScrollState, 0)
    })

    window.addEventListener('resize', updateScrollState)
    return () => {
      wrap.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', updateScrollState)
    }
  }, [tabs.length])

  const scrollBy = (dx: number) => wrapRef.current?.scrollBy({ left: dx, behavior: 'smooth' })

  useEffect(() => {
    const wrap = wrapRef.current
    const list = listRef.current
    if (!wrap || !list) return
    const activeEl = list.querySelector<HTMLDivElement>(`.scroll-item[data-key="${activeKey}"]`)
    if (!activeEl) return
    const wRect = wrap.getBoundingClientRect()
    const aRect = activeEl.getBoundingClientRect()
    if (aRect.left < wRect.left) wrap.scrollBy({ left: aRect.left - wRect.left - 16, behavior: 'smooth' })
    else if (aRect.right > wRect.right) wrap.scrollBy({ left: aRect.right - wRect.right + 16, behavior: 'smooth' })
  }, [activeKey])

  /* ---------- 右键菜单（细化规则） ---------- */
  type CtxItem = { k: string; icon: JSX.Element; label: string }
  type CtxState = { show: boolean; x: number; y: number; key: string | null; items: CtxItem[] }
  const [menu, setMenu] = useState<CtxState>({ show: false, x: 0, y: 0, key: null, items: [] })

  const isDashboard = (k: string) => {
    const t = tabs.find(t => t.key === k)
    return t ? t.closable === false || t.key === HOME_PATH : k === HOME_PATH
  }

  const buildCtxItems = (clickedKey: string): CtxItem[] => {
    const all = tabs
    const total = all.length
    const includeDashboard = all.some(t => t.closable === false || t.key === HOME_PATH)

    // 1) 仪表盘：仅“重新加载”
    if (isDashboard(clickedKey)) {
      return [{ k: 'reload', icon: <RotateCw size={14} />, label: '重新加载' }]
    }

    const isActive = clickedKey === activeKey
    const idx = all.findIndex(t => t.key === clickedKey)
    const hasLeft = all.slice(0, idx).some(t => t.closable !== false)
    const hasRight = all.slice(idx + 1).some(t => t.closable !== false)

    // 2) 只有两个标签且包含仪表盘：右击非仪表盘
    //    仅当该标签“被激活”时显示“重新加载”，否则不显示
    if (total === 2 && includeDashboard) {
      const list: CtxItem[] = []
      if (isActive) list.push({ k: 'reload', icon: <RotateCw size={14} />, label: '重新加载' })
      list.push({ k: 'close', icon: <X size={14} />, label: '关闭当前标签页' })
      list.push({ k: 'closeAll', icon: <Minus size={14} />, label: '关闭全部标签页' })
      return list
    }

    // 3) 常规（>=3 标签）
    const list: CtxItem[] = []
    if (isActive) {
      list.push({ k: 'reload', icon: <RotateCw size={14} />, label: '重新加载' })
    }
    list.push({ k: 'close', icon: <X size={14} />, label: '关闭当前标签页' })
    if (total >= 3) {
      list.push({ k: 'closeOthers', icon: <Split size={14} />, label: '关闭其他标签页' })
    }
    list.push({ k: 'closeAll', icon: <Minus size={14} />, label: '关闭全部标签页' })
    if (hasLeft) list.push({ k: 'closeLeft', icon: <PanelLeftClose size={14} />, label: '关闭左侧标签页' })
    if (hasRight) list.push({ k: 'closeRight', icon: <PanelRightClose size={14} />, label: '关闭右侧标签页' })
    return list
  }

  useEffect(() => {
    const hide = () => setMenu(m => ({ ...m, show: false }))
    document.addEventListener('click', hide)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', hide)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const onContextAction = (action: string) => {
    const tabKey = menu.key || activeKey
    switch (action) {
      case 'reload':
        tabKey === activeKey ? navigate(0) : navigate(tabKey)
        break
      case 'close':
        closeTab(tabKey)
        break
      case 'closeLeft': {
        const idx = tabs.findIndex(t => t.key === tabKey)
        tabs
          .slice(0, idx)
          .filter(t => t.closable !== false)
          .forEach(t => closeTab(t.key))
        break
      }
      case 'closeRight': {
        const idx = tabs.findIndex(t => t.key === tabKey)
        tabs
          .slice(idx + 1)
          .filter(t => t.closable !== false)
          .forEach(t => closeTab(t.key))
        break
      }
      case 'closeOthers':
        closeOthers(tabKey)
        break
      case 'closeAll':
        closeAll()
        break
    }
    setMenu(m => ({ ...m, show: false }))
  }

  return (
    <div
      className="tags-view"
      data-overflow={overflowing ? '1' : '0'}
      style={{
        position: 'fixed',
        top: fullscreen ? 0 : 47,
        left: fullscreen ? 0 : siderOffset,
        right: 0,
        zIndex: 999,
        height: 36,
        background: '#fff',
      }}
    >
      {/* 左箭头（隐藏时不占位） */}
      <span
        className="arrow-left"
        style={{
          display: overflowing ? 'flex' : 'none',
        //   opacity: canLeft ? 1 : 0.35,
          pointerEvents: canLeft ? 'auto' : 'none',
        }}
        title="向左查看更多"
        onClick={() => scrollBy(-SCROLL_STEP)}
      >
        <ChevronLeft size={18} />
      </span>

      {/* 滚动区 */}
      <div className="scroll-container" ref={wrapRef}>
        <div
          className="tab select-none"
          ref={listRef}
          style={{ transform: 'translateX(0px)', transition: 'transform .5s ease-in-out' }}
        >
          {items.map(({ key, title, closable }) => {
            const isActive = key === activeKey
            return (
              <div
                key={key}
                data-key={key}
                className={`scroll-item ${closable ? 'is-closable' : ''} ${isActive ? 'is-active' : ''}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => navigate(key)}
                onContextMenu={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenu({ show: true, x: e.clientX, y: e.clientY, key, items: buildCtxItems(key) })
                }}
                title={title}
              >
                <span className="tag-title">{title}</span>
                {closable && (
                  <span
                    className="tag-close"
                    aria-label="关闭标签"
                    title="关闭"
                    onClick={e => {
                      e.stopPropagation()
                      closeTab(key)
                    }}
                  >
                    <X size={14} strokeWidth={2} />
                  </span>
                )}
                <span className={isActive ? 'schedule-active' : 'schedule-out'} />
              </div>
            )
          })}
        </div>
      </div>

      {/* 右箭头（隐藏时不占位） */}
      <span
        className="arrow-right"
        style={{
          display: overflowing ? 'flex' : 'none',
        //   opacity: canRight ? 1 : 0.35,
          pointerEvents: canRight ? 'auto' : 'none',
        }}
        title="向右查看更多"
        onClick={() => scrollBy(SCROLL_STEP)}
      >
        <ChevronRight size={18} />
      </span>

      {/* 右键菜单（按规则动态渲染） */}
      <ul className="contextmenu" style={{ left: menu.x, top: menu.y, display: menu.show ? 'block' : 'none' }}>
        {menu.items.map(i => (
          <div key={i.k} style={{ display: 'flex', alignItems: 'center' }}>
            <li onClick={() => onContextAction(i.k)}>
              {i.icon} {i.label}
            </li>
          </div>
        ))}
      </ul>

      {/* 右上“更多” */}
      <div className="el-dropdown">
        <Dropdown
          menu={{ items: globalMenuItems, onClick: onGlobalMenuClick }}
          trigger={['click']}
          placement="bottomRight"
        >
          <span className="arrow-down" role="button" aria-haspopup="menu" title="更多标签操作">
            <ChevronDown size={16} />
          </span>
        </Dropdown>
      </div>
    </div>
  )
}
