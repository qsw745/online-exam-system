// src/shared/components/Header.tsx
import { App, Avatar, Dropdown, Spin, Tabs, Badge, Empty, Tooltip, type MenuProps } from 'antd'
import {
  Bell,
  ChevronDown,
  Languages,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Search as SearchIcon,
  Settings,
  Sun,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useTheme } from '@/app/providers/AntdThemeProvider'
import { api } from '@/shared/api/http'
import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import LayoutSwitchDrawer from '@/shared/components/LayoutSwitchDrawer'
import TopNav from '@/shared/components/TopNav'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useLayout } from '@/shared/contexts/LayoutContext'
import SearchPalette from '@/shared/components/SearchPalette'
import { withAppAssetPath, withAppBasePath } from '@/shared/router/basePath'
import './css/header.css'

const HEADER_HEIGHT = 48
function IconButton({
  title,
  'aria-label': ariaLabel,
  onClick,
  themeMode,
  iconSize = 16,
  children,
}: React.PropsWithChildren<{
  title?: string
  'aria-label'?: string
  onClick?: () => void
  themeMode: 'light' | 'dark'
  iconSize?: number
}>) {
  const hoverBg = themeMode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)'
  const [hovered, setHovered] = useState(false)

  const sizedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && typeof child.type !== 'string') {
      const prevStyle = (child.props as any)?.style || {}
      return React.cloneElement(child as React.ReactElement<any>, {
        size: iconSize,
        style: { width: iconSize, height: iconSize, display: 'block', ...prevStyle },
      })
    }
    return child
  })

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: 36,
        height: 36,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: 'none',
        backgroundColor: hovered ? hoverBg : 'transparent',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'background-color .2s',
        color: 'var(--app-colorText, inherit)',
        outline: 'none',
        fontSize: 0,
        lineHeight: 0,
        verticalAlign: 'middle',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {sizedChildren}
    </button>
  )
}



/* =============== 用户信息芯片 =============== */
function getDisplayName(u?: { nickname?: string; username?: string; email?: string }) {
  return u?.nickname?.trim() || u?.username?.trim() || (u?.email ? u.email.split('@')[0] : '用户')
}
function getInitials(name: string) {
  return name?.trim()?.[0]?.toUpperCase() || 'U'
}

function UserBadge({
  user,
  onGoProfile,
  onGoSettings,
  onLogout,
}: {
  user: any
  onGoProfile?: () => void
  onGoSettings: () => void
  onLogout: () => void
}) {
  const { t } = useLanguage()
  const name = getDisplayName(user)
  const items: MenuProps['items'] = [
    { key: 'settings', icon: <Settings size={16} />, label: t('header.account_settings') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogOut size={16} />, label: t('header.logout'), danger: true },
  ]
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === 'profile') onGoProfile?.()
          else if (key === 'settings') onGoSettings()
          else if (key === 'logout') onLogout()
        },
      }}
    >
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          padding: '0 10px 0 6px',
          borderRadius: 999,
          border: '1px solid var(--app-colorSplit, rgba(0,0,0,.08))',
          background: 'var(--surface-1, #fff)',
          color: 'var(--app-colorText, inherit)',
          cursor: 'pointer',
        }}
      >
        <Avatar
          src={user?.avatar_url || undefined}
          size={24}
          style={{ background: 'var(--app-colorPrimaryBgHover, #e6f4ff)', color: 'var(--app-colorText, #1677ff)' }}
        >
          {getInitials(name)}
        </Avatar>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        </div>
        <ChevronDown size={16} style={{ opacity: 0.7 }} />
      </button>
    </Dropdown>
  )
}

/* =============== 通知/消息/待办 =============== */
type InboxTabKey = 'notice' | 'message' | 'todo'
type InboxItem = {
  id: string
  title: string
  content?: string
  read?: boolean
  done?: boolean
  created_at?: string
  target_path?: string | null
  source?: string | null
  metadata?: any
}

/** 从 ApiResult 或 ApiFailure 中稳定提取字段（解决 TS 上看不到 data 的问题） */
function extractFieldFromResult(result: unknown, field: string, fallback = 0): number {
  try {
    const v: any = result as any
    const payload = v && typeof v === 'object' && 'success' in v ? (v as any).data : v
    const num = Number(payload?.[field] ?? fallback)
    return Number.isFinite(num) ? num : fallback
  } catch {
    return fallback
  }
}

function useInbox() {
  const { t } = useLanguage()
  const { message: antdMsg } = App.useApp()

  const [counts, setCounts] = useState<{ notice: number; message: number; todo: number }>({
    notice: 0,
    message: 0,
    todo: 0,
  })
  const [lists, setLists] = useState<{ notice: InboxItem[]; message: InboxItem[]; todo: InboxItem[] }>({
    notice: [],
    message: [],
    todo: [],
  })
  const [loading, setLoading] = useState<{ notice: boolean; message: boolean; todo: boolean }>({
    notice: false,
    message: false,
    todo: false,
  })

  // —— 计数：用于图标角标
  const loadCounts = async () => {
    try {
      const [n, m, t] = await Promise.allSettled([
        api.get('/notifications/unread-count'),
        api.get('/messages/unread-count'),
        api.get('/todos/pending-count'),
      ])
      const notice = n.status === 'fulfilled' ? extractFieldFromResult(n.value, 'unreadCount', 0) : 0
      const message = m.status === 'fulfilled' ? extractFieldFromResult(m.value, 'unreadCount', 0) : 0
      const todo = t.status === 'fulfilled' ? extractFieldFromResult(t.value, 'pendingCount', 0) : 0
      setCounts({ notice, message, todo })
    } catch {
      setCounts({ notice: 0, message: 0, todo: 0 })
    }
  }

  // —— 列表：按 Tab 拉取
  const normalizeNotice = (items: any[]): InboxItem[] =>
    (items || []).map(it => ({
      ...it,
      read: typeof it.read === 'boolean' ? it.read : !!it.is_read,
      created_at: it.created_at || it.createdAt,
    }))
  const normalizeMessage = normalizeNotice
  const normalizeTodo = (items: any[]): InboxItem[] =>
    (items || []).map(it => ({
      ...it,
      done: typeof it.done === 'boolean' ? it.done : !!it.is_done,
      created_at: it.created_at || it.createdAt,
      target_path: it.target_path ?? it.targetPath ?? null,
      source: it.source ?? null,
      metadata: it.metadata ?? null,
    }))

  const loadList = async (tab: InboxTabKey) => {
    try {
      setLoading(s => ({ ...s, [tab]: true }))
      if (tab === 'notice') {
        const resp: any = await api.get('/notifications')
        const arr: InboxItem[] = Array.isArray(resp?.data?.notifications ?? resp?.notifications)
          ? resp?.data?.notifications ?? resp?.notifications
          : []
        setLists(s => ({ ...s, notice: normalizeNotice(arr) }))
      } else if (tab === 'message') {
        const resp: any = await api.get('/messages')
        const arr: InboxItem[] = Array.isArray(resp?.data?.messages ?? resp?.messages)
          ? resp?.data?.messages ?? resp?.messages
          : []
        setLists(s => ({ ...s, message: normalizeMessage(arr) }))
      } else {
        const resp: any = await api.get('/todos')
        const arr: InboxItem[] = Array.isArray(resp?.data?.todos ?? resp?.todos) ? resp?.data?.todos ?? resp?.todos : []
        setLists(s => ({ ...s, todo: normalizeTodo(arr) }))
      }
    } catch (e: any) {
      antdMsg.error(e?.message || t('common.load_failed'))
    } finally {
      setLoading(s => ({ ...s, [tab]: false }))
    }
  }

  // —— 状态更新
  const markNoticeRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setLists(s => ({
        ...s,
        notice: s.notice.map(i => (i.id === id ? { ...i, read: true, is_read: true } : i)),
      }))
      setCounts(c => ({ ...c, notice: Math.max(0, c.notice - 1) }))
    } catch {}
  }
  const markMessageRead = async (id: string) => {
    try {
      await api.put(`/messages/${id}/read`)
      setLists(s => ({ ...s, message: s.message.map(i => (i.id === id ? { ...i, read: true } : i)) }))
      setCounts(c => ({ ...c, message: Math.max(0, c.message - 1) }))
    } catch {}
  }
  const markTodoDone = async (id: string) => {
    try {
      await api.put(`/todos/${id}/done`)
      setLists(s => ({ ...s, todo: s.todo.map(i => (i.id === id ? { ...i, done: true } : i)) }))
      setCounts(c => ({ ...c, todo: Math.max(0, c.todo - 1) }))
    } catch {}
  }

  return { counts, lists, loading, loadCounts, loadList, markNoticeRead, markMessageRead, markTodoDone }
}

function InboxBell({ themeMode }: { themeMode: 'light' | 'dark' }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { counts, lists, loading, loadCounts, loadList, markNoticeRead, markMessageRead, markTodoDone } = useInbox()
  const totalBadge = counts.notice + counts.message + counts.todo

  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<InboxTabKey>('notice')
  const ref = useRef<HTMLDivElement>(null)

  // 初始拉计数
  useEffect(() => {
    loadCounts()
  }, [])

  // 打开时拉当前 tab 列表
  useEffect(() => {
    if (open) loadList(activeKey)
  }, [open, activeKey])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const getTodoTarget = (item: InboxItem) => {
    const meta = item.metadata || {}
    if (meta?.entity_type && meta?.entity_id) {
      if (meta.entity_type === 'paper') return `/admin/paper-detail/${meta.entity_id}`
      if (meta.entity_type === 'exam') return `/exam/${meta.entity_id}`
    }
    return item.target_path || null
  }

  const renderList = (tab: InboxTabKey) => {
    const data = lists[tab]
    const busy = loading[tab]
    if (busy) {
      return (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      )
    }
    if (!data || data.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.no_data')} style={{ padding: '24px 0' }} />
    }
    return (
      <div>
        {data.map(item => {
          const muted = tab === 'todo' ? item.done : item.read
          const todoTarget = tab === 'todo' ? getTodoTarget(item) : null
          const onAction =
            tab === 'notice'
              ? () => markNoticeRead(item.id)
              : tab === 'message'
              ? () => markMessageRead(item.id)
              : () => markTodoDone(item.id)
          const actionText = tab === 'todo' ? (item.done ? t('header.done') : t('header.mark_done')) : item.read ? t('header.read') : t('header.mark_read')
          return (
            <div
              key={item.id}
              style={{
                padding: '12px 0',
                borderTop: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
                backgroundColor: !muted
                  ? themeMode === 'dark'
                    ? 'rgba(255,255,255,.06)'
                    : 'rgba(0,0,0,.04)'
                  : 'transparent',
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{ flex: 1, minWidth: 0, cursor: todoTarget ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (todoTarget) {
                      navigate(todoTarget)
                      setOpen(false)
                    }
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-colorText)' }}>
                    {item.title || t('header.untitled')}
                  </div>
                  {item.content && (
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--app-colorTextSecondary)' }}>
                      {item.content}
                    </div>
                  )}
                  {todoTarget && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--app-colorPrimary)' }}>{t('header.view_detail')}</div>
                  )}
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onAction()
                  }}
                  disabled={muted}
                  style={{
                    flexShrink: 0,
                    border: 'none',
                    background: 'transparent',
                    color: muted ? 'var(--app-colorTextTertiary)' : 'var(--app-colorPrimary)',
                    cursor: muted ? 'default' : 'pointer',
                    fontSize: 13,
                  }}
                  title={actionText}
                >
                  {actionText}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <Badge count={totalBadge} size="small" offset={[-6, 6]}>
        <span>
          <IconButton title={t('header.notifications')} aria-label={t('header.notifications')} onClick={() => setOpen(s => !s)} themeMode={themeMode}>
            <Bell />
          </IconButton>
        </span>
      </Badge>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 8,
            width: 360,
            borderRadius: 10,
            backgroundColor: 'var(--app-colorBgElevated, #fff)',
            color: 'var(--app-colorText, #374151)',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05)',
            border: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
            zIndex: 3000,
          }}
        >
          <div style={{ padding: 12, borderBottom: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))' }}>
            <strong style={{ fontSize: 14 }}>{t('header.notification_center')}</strong>
          </div>

          <div style={{ padding: '0 12px 12px' }}>
            <Tabs
              activeKey={activeKey}
              onChange={k => setActiveKey(k as InboxTabKey)}
              items={[
                {
                  key: 'notice',
                  label: (
                    <span>
                      {t('header.tab_notice')} <Badge count={counts.notice} size="small" style={{ marginLeft: 6 }} />
                    </span>
                  ),
                  children: renderList('notice'),
                },
                {
                  key: 'message',
                  label: (
                    <span>
                      {t('header.tab_message')} <Badge count={counts.message} size="small" style={{ marginLeft: 6 }} />
                    </span>
                  ),
                  children: renderList('message'),
                },
                {
                  key: 'todo',
                  label: (
                    <span>
                      {t('header.tab_todo')} <Badge count={counts.todo} size="small" style={{ marginLeft: 6 }} />
                    </span>
                  ),
                  children: renderList('todo'),
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* =============== Header 主组件 =============== */
type HeaderProps = { onMobileMenuToggle?: () => void }

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const { mode, collapsed, showBrand } = useLayout()
  const { mode: themeMode, toggle } = useTheme()
  const { language, setLanguage, t } = useLanguage()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const getFsElement = () =>
    (document as any).fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!getFsElement())
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!getFsElement())
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange as any)
    document.addEventListener('mozfullscreenchange', onFsChange as any)
    document.addEventListener('MSFullscreenChange', onFsChange as any)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as any)
      document.removeEventListener('mozfullscreenchange', onFsChange as any)
      document.removeEventListener('MSFullscreenChange', onFsChange as any)
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (!getFsElement()) {
        const el: any = document.documentElement as any
        await (el.requestFullscreen?.() ||
          el.webkitRequestFullscreen?.() ||
          el.mozRequestFullScreen?.() ||
          el.msRequestFullscreen?.())
      } else {
        await (document.exitFullscreen?.() ||
          (document as any).webkitExitFullscreen?.() ||
          (document as any).mozCancelFullScreen?.() ||
          (document as any).msExitFullscreen?.())
      }
    } catch (e) {
      console.error('全屏切换失败', e)
    }
  }

  useEffect(() => {
    ;(window as any).__openSearch = () => setSearchOpen(true)
    return () => {
      if ((window as any).__openSearch) delete (window as any).__openSearch
    }
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('退出登录错误:', error)
      message.error(t('header.logout_failed'))
    }
  }

  const siderWidth = collapsed ? 64 : 240
  const offsetLeft = mode !== 'top' ? siderWidth : 0
  const showBrandInHeader = showBrand && mode === 'top'

  const langMenuItems: MenuProps['items'] = [
    {
      key: 'zh-CN',
      label: (
        <span style={{ fontSize: 14, fontWeight: language === 'zh-CN' ? 600 : 400 }}>
          {language === 'zh-CN' ? '✓ ' : ''}{t('language.zh-CN')}
        </span>
      ),
    },
    {
      key: 'en-US',
      label: (
        <span style={{ fontSize: 14, fontWeight: language === 'en-US' ? 600 : 400 }}>
          {language === 'en-US' ? '✓ ' : ''}English
        </span>
      ),
    },
  ]

  return (
    <header
      className="app-header"
      style={{
        position: 'fixed',
        top: 0,
        left: offsetLeft,
        width: `calc(100% - ${offsetLeft}px)`,
        zIndex: 1000,
        height: HEADER_HEIGHT,
        borderBottom: '1px solid var(--header-border)',
        backgroundColor: 'var(--header-bg)',
        color: 'var(--text-1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          height: '100%',
          gap: 12,
          padding: '0 12px',
          boxSizing: 'border-box',
        }}
      >
        {/* 左区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {mode === 'side' ? (
            <AppBreadcrumb />
          ) : showBrandInHeader ? (
            <a
              href={withAppBasePath('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: 'none',
                color: 'var(--app-colorText, inherit)',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <img
                src={withAppAssetPath('/brand-logo.svg')}
                alt="Logo"
                width={20}
                height={20}
                style={{ display: 'block' }}
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
              {t('app.title')}
            </a>
          ) : null}

          {mode !== 'side' && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <TopNav className="app-topnav" />
            </div>
          )}
        </div>

        {/* 右区 */}
        <nav style={{ display: 'grid', gridAutoFlow: 'column', alignItems: 'center', gap: 12 }}>
          <IconButton
            themeMode={themeMode}
            title={t('header.search_tooltip')}
            aria-label={t('app.search')}
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon />
          </IconButton>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: langMenuItems,
              onClick: ({ key }) => setLanguage(key as 'zh-CN' | 'en-US'),
            }}
          >
            <span>
              <IconButton themeMode={themeMode} title={t('header.language')} aria-label={t('header.language')}>
                <Languages />
              </IconButton>
            </span>
          </Dropdown>
          <IconButton
            themeMode={themeMode}
            title={isFullscreen ? t('header.exit_fullscreen_esc') : t('header.fullscreen')}
            aria-label={isFullscreen ? t('header.exit_fullscreen') : t('header.fullscreen')}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
          <IconButton
            themeMode={themeMode}
            title={themeMode === 'dark' ? t('header.theme_to_light') : t('header.theme_to_dark')}
            aria-label={themeMode === 'dark' ? t('header.theme_to_light') : t('header.theme_to_dark')}
            onClick={toggle}
          >
            {themeMode === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
          <IconButton
            themeMode={themeMode}
            title={t('layout.title')}
            aria-label={t('layout.title')}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
          </IconButton>

          {/* 三块通知汇总（角标=三块总和） */}
          <InboxBell themeMode={themeMode} />

          {/* 用户 */}
          <UserBadge
            user={user}
            onGoSettings={() => navigate('/settings')}
            onLogout={async () => {
              try {
                await signOut()
                navigate('/login')
              } catch (e) {
                message.error(t('header.logout_failed'))
              }
            }}
          />
        </nav>
      </div>

      <LayoutSwitchDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
