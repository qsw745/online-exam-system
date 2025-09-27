// src/shared/components/Header.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Input, message, Spin, Tooltip, type MenuProps } from 'antd'
import { Bell, LogOut, Moon, Search as SearchIcon, Settings, Sun, User as UserIcon, ChevronDown } from 'lucide-react'

import { useTheme } from '@/app/providers/AntdThemeProvider'
import { api } from '@/shared/api/http'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { MenuItem, useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'
import { useTabs } from '@/shared/contexts/TabsContext'

type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
const pickData = <T,>(resp: any, fallback: T): T =>
  isSuccess<T>(resp) ? (resp.data as T) ?? fallback : (resp?.data as T) ?? fallback

/* ====================== 搜索 ====================== */

type MenuEntry = { id: number; title: string; path: string }
const hasDynamic = (p?: string | null) => !!p && /[:\[\{]/.test(p || '')
function flattenMenus(ms: MenuItem[]): MenuEntry[] {
  const out: MenuEntry[] = []
  const walk = (nodes: MenuItem[]) => {
    for (const n of nodes) {
      if (n.is_hidden) continue
      if (n.path && !hasDynamic(n.path)) out.push({ id: n.id, title: n.title, path: n.path })
      if (n.children?.length) walk(n.children)
    }
  }
  walk(ms)
  const seen = new Set<string>()
  return out.filter(e => (seen.has(e.path) ? false : (seen.add(e.path), true)))
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        minWidth: 22,
        padding: '1px 6px',
        border: '1px solid var(--app-colorSplit, rgba(0,0,0,.15))',
        borderBottomWidth: 2,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.2,
        textAlign: 'center',
        background: 'var(--app-colorBgContainer, #fff)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.06)',
      }}
    >
      {children}
    </kbd>
  )
}

function HeaderSearch() {
  const { menus } = useMenuPermissions()
  const { addOrActivate } = useTabs()
  const entries = useMemo(() => flattenMenus(menus), [menus])

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return entries.slice(0, 12)
    return entries
      .map(e => ({ e, score: e.title.toLowerCase().includes(kw) ? 0 : e.path.toLowerCase().includes(kw) ? 1 : 9 }))
      .filter(x => x.score < 9)
      .sort((a, b) => a.score - b.score || a.e.title.localeCompare(b.e.title))
      .slice(0, 12)
      .map(x => x.e)
  }, [q, entries])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const go = (entry: MenuEntry) => {
    addOrActivate({ key: entry.path, title: entry.title, closable: entry.path !== '/' })
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={wrapRef} style={{ width: 'min(520px, 100%)', position: 'relative' }}>
      <Input
        ref={inputRef as any}
        value={q}
        onChange={e => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive(s => Math.min(s + 1, Math.max(0, results.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive(s => Math.max(0, s - 1))
          } else if (e.key === 'Enter') {
            const pick = results[active]
            if (pick) go(pick)
          } else if (e.key === 'Escape') {
            ;(e.target as HTMLInputElement).blur()
            setOpen(false)
          }
        }}
        size="middle"
        allowClear
        placeholder="输入关键字搜索…"
        prefix={<SearchIcon size={16} />}
        style={{ height: 32, borderRadius: 16, background: 'var(--app-colorBgContainer, #fff)' }}
        suffix={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
            <Kbd>Ctrl</Kbd>
            <span style={{ fontSize: 12, color: 'var(--app-colorTextTertiary, #999)' }}>+</span>
            <Kbd>K</Kbd>
          </span>
        }
      />

      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 40,
            borderRadius: 12,
            background: 'var(--app-colorBgElevated, #fff)',
            border: '1px solid var(--app-colorSplit, rgba(0,0,0,.08))',
            boxShadow: '0 6px 20px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)',
            zIndex: 2001,
            overflow: 'hidden',
          }}
          onMouseLeave={() => setActive(0)}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 8, maxHeight: 360, overflowY: 'auto' }}>
            {results.map((r, idx) => (
              <li key={r.path}>
                <button
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: idx === active ? 'var(--app-colorPrimaryBgHover, #f0f7ff)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14, textAlign: 'left' }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--app-colorTextTertiary, #999)', whiteSpace: 'nowrap' }}>
                    {r.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ====================== 用户信息芯片 ====================== */

function getDisplayName(u?: { nickname?: string; username?: string; email?: string }) {
  return u?.nickname?.trim() || u?.username?.trim() || (u?.email ? u.email.split('@')[0] : '用户')
}

function getInitials(name: string) {
  // 简单取首字符（中文/英文都 ok）
  return name?.trim()?.[0]?.toUpperCase() || 'U'
}

function UserBadge({
  user,
  onGoProfile,
  onGoSettings,
  onLogout,
}: {
  user: any
  onGoProfile: () => void
  onGoSettings: () => void
  onLogout: () => void
}) {
  const name = getDisplayName(user)
  const email = user?.email || ''
  const items: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserIcon size={16} />,
      label: '个人资料',
    },
    {
      key: 'settings',
      icon: <Settings size={16} />,
      label: '设置',
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogOut size={16} />,
      label: '退出登录',
      danger: true,
    },
  ]

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === 'profile') onGoProfile()
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
          background: 'var(--app-colorBgContainer, #fff)',
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
          <Tooltip title={email}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--app-colorTextTertiary, #999)',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email}
            </span>
          </Tooltip>
        </div>
        <ChevronDown size={16} style={{ opacity: 0.7 }} />
      </button>
    </Dropdown>
  )
}

/* ====================== Header（固定在顶） ====================== */

type HeaderProps = {
  onMobileMenuToggle?: () => void // 兼容 Layout 里传入的可选回调
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { mode, toggle } = useTheme()
  const { t } = useLanguage()

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const notificationRef = React.useRef<HTMLDivElement>(null)

  const hoverBg = mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)'
  const iconBtnBase: React.CSSProperties = {
    width: 36,
    height: 36,
    display: 'grid',
    placeItems: 'center',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color .2s',
    color: 'var(--app-colorText, inherit)',
    outline: 'none',
    fontSize: 0,
    lineHeight: 0,
    verticalAlign: 'middle',
  }
  const iconSvgStyle: React.CSSProperties = { width: 20, height: 20, display: 'block' }
  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) =>
      ((e.currentTarget.style as any).backgroundColor = hoverBg),
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) =>
      ((e.currentTarget.style as any).backgroundColor = 'transparent'),
  }

  useEffect(() => {
    if (showNotifications) loadNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications])

  useEffect(() => {
    if (user) {
      loadUnreadCount()
      const timer = setInterval(loadUnreadCount, 60_000)
      return () => clearInterval(timer)
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true)
      const resp: ApiResult<{ notifications?: any[]; unreadCount?: number }> | any = await api.get('/notifications')
      const data = pickData<{ notifications?: any[]; unreadCount?: number }>(resp, {})
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(Number(data.unreadCount ?? 0))
    } catch (error: any) {
      console.error('加载通知错误:', error)
      message.error(error.message || t('error.load_notifications'))
    } finally {
      setNotificationsLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const resp: ApiResult<{ unreadCount: number }> | any = await api.get('/notifications/unread-count')
      const data = pickData<{ unreadCount?: number }>(resp, {})
      setUnreadCount(Number(data.unreadCount ?? 0))
    } catch (error: any) {
      console.error('加载未读通知数量错误:', error)
      message.error(error.message || t('error.load_unread_count'))
      setUnreadCount(0)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`)
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read: true } : n)))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error: any) {
      console.error('标记通知为已读错误:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error: any) {
      console.error('退出登录错误:', error)
      message.error(t('error.logout'))
    }
  }

  return (
    <header
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 2000,
        width: '100%',
        height: 55,
        borderBottom: '1px solid var(--app-colorSplit, #e5e7eb)',
        backgroundColor: 'var(--app-colorBgElevated, rgba(255,255,255,.95))',
        color: 'var(--app-colorText, #111827)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          padding: '0 40px',
          gap: 12,
        }}
      >
        {/* Logo + 名称 */}
        <a
          href="/"
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
            src="/brand-logo.svg"
            alt="Logo"
            width={20}
            height={20}
            style={{ display: 'block' }}
            onError={e => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          在线考试系统
        </a>

        {/* 中部：搜索 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <HeaderSearch />
        </div>

        {/* 右侧图标 */}
        <nav style={{ display: 'grid', gridAutoFlow: 'column', alignItems: 'center', gap: 12 }}>
          {/* 可选：触发移动端侧栏 */}
          {onMobileMenuToggle && (
            <button onClick={onMobileMenuToggle} style={{ ...iconBtnBase }} {...hoverHandlers} aria-label="菜单">
              <span style={{ fontSize: 14 }}>≡</span>
            </button>
          )}

          <button
            onClick={toggle}
            style={iconBtnBase}
            {...hoverHandlers}
            aria-label={mode === 'dark' ? '切换到浅色' : '切换到深色'}
            title={mode === 'dark' ? '切换到浅色' : '切换到深色'}
          >
            {mode === 'dark' ? <Sun style={iconSvgStyle} /> : <Moon style={iconSvgStyle} />}
          </button>

          <div style={{ position: 'relative' }} ref={notificationRef}>
            <button onClick={() => setShowNotifications(s => !s)} style={iconBtnBase} {...hoverHandlers}>
              <Bell style={iconSvgStyle} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    display: 'grid',
                    placeItems: 'center',
                    height: 16,
                    width: 16,
                    borderRadius: '50%',
                    backgroundColor: 'var(--app-colorError, #ef4444)',
                    fontSize: 10,
                    color: '#fff',
                    lineHeight: 1,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: 8,
                  width: 320,
                  borderRadius: 10,
                  backgroundColor: 'var(--app-colorBgElevated, #fff)',
                  color: 'var(--app-colorText, #374151)',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05)',
                  border: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
                  zIndex: 3000,
                }}
              >
                <div style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>通知</h3>
                  <div style={{ marginTop: 8 }}>
                    {notificationsLoading ? (
                      <div style={{ padding: '16px 0', textAlign: 'center' }}>
                        <Spin size="small" />
                      </div>
                    ) : notifications.length > 0 ? (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          style={{
                            padding: '16px 0',
                            borderTop: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
                            backgroundColor: !n.read
                              ? mode === 'dark'
                                ? 'rgba(255,255,255,.06)'
                                : 'rgba(0,0,0,.04)'
                              : 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() => markAsRead(n.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            <div style={{ marginLeft: 12, flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{n.title}</p>
                              <p
                                style={{
                                  marginTop: 4,
                                  fontSize: 14,
                                  color: 'var(--app-colorTextSecondary)',
                                  marginBottom: 0,
                                }}
                              >
                                {n.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          padding: '16px 0',
                          textAlign: 'center',
                          fontSize: 14,
                          color: 'var(--app-colorTextSecondary)',
                        }}
                      >
                        暂无通知
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ✅ 新增：用户信息芯片（替代单独的设置 / 个人图标按钮） */}
          {user && (
            <UserBadge
              user={user}
              onGoProfile={() => navigate('/profile')}
              onGoSettings={() => navigate('/settings')}
              onLogout={handleLogout}
            />
          )}
        </nav>
      </div>
    </header>
  )
}
