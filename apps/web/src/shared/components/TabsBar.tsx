// src/shared/components/TabsBar.tsx
import { useLayout } from '@/shared/contexts/LayoutContext'
import { useTabs } from '@/shared/contexts/TabsContext'
import { Dropdown, Tabs, type MenuProps } from 'antd'
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelRightClose,
  RotateCw,
  Split,
  X,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './css/TabsBar.css'

export const TabsBar: React.FC = () => {
  const navigate = useNavigate()
  const { tabs, activeKey, closeTab, closeOthers, closeAll } = useTabs()
  const { showTabs, mode, collapsed } = useLayout()

  const hasSider = mode === 'side' || mode === 'mix'
  const siderOffset = hasSider ? (collapsed ? 64 : 240) : 0

  // 当前激活位置 & 左右可关列表
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

  // 全屏切换（可选）
  const [fullscreen, setFullscreen] = useState(false)
  const toggleFullscreen = () => {
    setFullscreen(s => {
      const next = !s
      if (next) document.body.setAttribute('data-content-fullscreen', '1')
      else document.body.removeAttribute('data-content-fullscreen')
      return next
    })
  }

  // —— 全局菜单（右侧下拉按钮） ——
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

  // —— 每个标签的右键菜单 ——（和你截图一致）
  const buildTabContextMenu = (key: string): MenuProps['items'] => [
    { key: `reload:${key}`, icon: <RotateCw size={16} />, label: '重新加载' },
    { type: 'divider' as const },
    { key: `close:${key}`, icon: <X size={16} />, label: '关闭当前标签页' },
    {
      key: `closeLeft:${key}`,
      icon: <PanelLeftClose size={16} />,
      label: '关闭左侧标签页',
      disabled: key === activeKey ? leftKeys.length === 0 : false,
    },
    {
      key: `closeRight:${key}`,
      icon: <PanelRightClose size={16} />,
      label: '关闭右侧标签页',
      disabled: key === activeKey ? rightKeys.length === 0 : false,
    },
    { type: 'divider' as const },
    { key: `closeOthers:${key}`, icon: <Split size={16} />, label: '关闭其他标签页' },
    { key: `closeAll:${key}`, icon: <Minus size={16} />, label: '关闭全部标签页' },
  ]

  const onTabMenuClick: MenuProps['onClick'] = ({ key }) => {
    // key 形如 "close:xxx"
    const [action, tabKey] = String(key).split(':')
    switch (action) {
      case 'reload':
        if (tabKey === activeKey) navigate(0)
        else navigate(tabKey) // 先切过去再刷新（可选）
        break
      case 'close':
        closeTab(tabKey)
        break
      case 'closeLeft': {
        const idx = tabs.findIndex(t => t.key === tabKey)
        const ks = tabs
          .slice(0, idx)
          .filter(t => t.closable !== false)
          .map(t => t.key)
        ks.forEach(k => closeTab(k))
        break
      }
      case 'closeRight': {
        const idx = tabs.findIndex(t => t.key === tabKey)
        const ks = tabs
          .slice(idx + 1)
          .filter(t => t.closable !== false)
          .map(t => t.key)
        ks.forEach(k => closeTab(k))
        break
      }
      case 'closeOthers': {
        closeOthers(tabKey)
        break
      }
      case 'closeAll':
        closeAll()
        break
    }
  }

  if (!showTabs) return null

  // 构造带右键菜单的自定义 label
  // 片段：构造 items（替换你当前的 items useMemo）
  const items = useMemo(
    () =>
      tabs.map(t => ({
        key: t.key,
        // line 类型没有 closable 概念，改用自定义 label
        label: (
          <Dropdown
            menu={{ items: buildTabContextMenu(t.key), onClick: onTabMenuClick }}
            trigger={['contextMenu']}
            placement="bottomLeft"
          >
            <span className="tab-label-wrap" title={t.title}>
              <span>{t.title}</span>
              {t.closable !== false && (
                <span
                  className="tab-close"
                  onClick={e => {
                    e.stopPropagation()
                    closeTab(t.key)
                  }}
                  aria-label="关闭标签"
                  title="关闭"
                >
                  <X size={14} strokeWidth={2} />
                </span>
              )}
            </span>
          </Dropdown>
        ),
      })),
    [tabs]
  )

  return (
    <div
      className="app-tabs-bar"
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
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Tabs
            className="app-tabs-bar-tabs"
            type="line"
            size="small"
            hideAdd
            items={items}
            activeKey={activeKey}
            onChange={k => navigate(k)}
            onEdit={(targetKey, action) => action === 'remove' && typeof targetKey === 'string' && closeTab(targetKey)}
            tabBarExtraContent={
              <Dropdown
                menu={{ items: globalMenuItems, onClick: onGlobalMenuClick }}
                trigger={['click']}
                placement="bottomRight"
              >
                <button
                  aria-label="更多标签操作"
                  title="更多标签操作"
                  style={{
                    height: 26,
                    width: 26,
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid transparent',
                    background: 'transparent',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <ChevronDown size={16} />
                </button>
              </Dropdown>
            }
          />
        </div>
      </div>
    </div>
  )
}
