// src/shared/components/Header.tsx
import { App, Avatar, Dropdown, Input, Modal, Spin, Tooltip, type MenuProps } from 'antd'
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
import { useMenuPermissions, type MenuItem } from '@/shared/contexts/MenuPermissionContext'
import { useTabs } from '@/shared/contexts/TabsContext'
import './css/header.css'

const HEADER_HEIGHT = 48

type MenuEntry = { id: number; title: string; path: string }
const hasDynamic = (p?: string | null) => !!p && /[:\[\{]/.test(p || '')
function flattenMenus(ms: MenuItem[]): MenuEntry[] {
  const out: MenuEntry[] = []
  const seen = new Set<string>()
  const clean = (p: string) => ('/' + (p || '')).replace(/\/{2,}/g, '/').replace(/(?:\/index|-index)(?=\/?$)/, '')
  const walk = (nodes: MenuItem[]) => {
    for (const m of nodes || []) {
      if ((m as any).is_hidden) continue
      const rawPath = (m as any).path
      if (rawPath && !hasDynamic(rawPath)) {
        const path = clean(rawPath)
        if (!seen.has(path)) {
          seen.add(path)
          out.push({ id: (m as any).id, title: (m as any).title, path })
        }
      }
      const children = (m as any).children
      if (children?.length) walk(children)
    }
  }
  walk(ms)
  return out
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

/* =============== 搜索面板（命令面板） =============== */
/* =============== 搜索面板（命令面板） =============== */
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { menus } = useMenuPermissions()
  const { addOrActivate } = useTabs()
  const entries = useMemo(() => flattenMenus(menus), [menus])

  // —— 本地存储 keys
  const HISTORY_KEY = 'cmdp:history'
  const FAV_KEY = 'cmdp:favorites'

  // —— 状态
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [history, setHistory] = useState<MenuEntry[]>([])
  const [favs, setFavs] = useState<string[]>([]) // 保存 path

  const inputRef = useRef<HTMLInputElement>(null)

  // —— 辅助：读写 localStorage
  const loadPersist = useCallback(() => {
    try {
      const hs = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as MenuEntry[]
      const fs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[]
      setHistory(Array.isArray(hs) ? hs : [])
      setFavs(Array.isArray(fs) ? fs : [])
    } catch {
      setHistory([])
      setFavs([])
    }
  }, [])

  const saveHistory = useCallback((list: MenuEntry[]) => {
    setHistory(list)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 12)))
    } catch {}
  }, [])

  const saveFavs = useCallback((list: string[]) => {
    setFavs(list)
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list))
    } catch {}
  }, [])

  // —— 打开时聚焦并加载历史/收藏
  useEffect(() => {
    if (!open) return
    loadPersist()
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open, loadPersist])

  // —— 全局快捷键：Ctrl/⌘+K 切换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault()
        if (!open) (window as any).__openSearch?.()
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // —— 搜索：为空时不返回默认菜单（避免一上来列表塞满）
  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return [] as MenuEntry[]
    return entries
      .map(e => ({
        e,
        score: e.title.toLowerCase().includes(kw) ? 0 : e.path.toLowerCase().includes(kw) ? 1 : 9,
      }))
      .filter(x => x.score < 9)
      .sort((a, b) => a.score - b.score || a.e.title.localeCompare(b.e.title))
      .slice(0, 12)
      .map(x => x.e)
  }, [q, entries])

  // —— 展示用的数据：当 q 为空时，展示 收藏 + 历史
  const favEntries = useMemo(
    () => favs.map(p => entries.find(e => e.path === p)).filter(Boolean) as MenuEntry[],
    [favs, entries]
  )
  const historyEntries = useMemo(() => {
    // 只展示仍然存在的菜单
    const ok = new Map(entries.map(e => [e.path, e]))
    return history.map(h => ok.get(h.path)).filter(Boolean) as MenuEntry[]
  }, [history, entries])

  // —— 进入页面
  const go = (entry: MenuEntry) => {
    addOrActivate({ key: entry.path, title: entry.title, closable: entry.path !== '/' })
    // 写入历史：去重后置顶
    const next = [entry, ...history.filter(h => h.path !== entry.path)]
    saveHistory(next)
    setQ('')
    setActive(0)
    onClose()
  }

  const toggleFav = (entry: MenuEntry) => {
    const exists = favs.includes(entry.path)
    const next = exists ? favs.filter(p => p !== entry.path) : [entry.path, ...favs]
    saveFavs(next)
  }

  const removeHistory = (entry: MenuEntry) => {
    saveHistory(history.filter(h => h.path !== entry.path))
  }

  // —— 键盘导航：根据当前显示的列表决定长度
  const visibleList: MenuEntry[] = q.trim()
    ? results
    : [...favEntries, ...historyEntries] // 上方先收藏，再历史
  useEffect(() => {
    setActive(0)
  }, [q, open])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      centered
      destroyOnHidden
      getContainer={() => document.body}
      styles={{ content: { padding: 0, borderRadius: 12, overflow: 'hidden' }, body: { padding: 0 } }}
    >
      {/* 顶部输入 */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--app-colorBgContainer, #fff)',
            border: '1px solid var(--app-colorSplit, rgba(0,0,0,.08))',
            borderRadius: 10,
            padding: '6px 10px',
          }}
        >
          <SearchIcon size={16} />
          <Input
            ref={inputRef as any}
            variant="borderless"
            placeholder="搜索菜单（支持拼音）"
            value={q}
            onChange={e => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive(s => Math.min(s + 1, Math.max(0, visibleList.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive(s => Math.max(0, s - 1))
              } else if (e.key === 'Enter') {
                const pick = visibleList[active]
                if (pick) go(pick)
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            style={{ height: 28 }}
            suffix={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
                <Kbd>Ctrl</Kbd>
                <span style={{ fontSize: 12, color: 'var(--app-colorTextTertiary, #999)' }}>+</span>
                <Kbd>K</Kbd>
              </span>
            }
          />
        </div>
      </div>

      {/* 列表区域 */}
      <div style={{ maxHeight: 420, overflowY: 'auto', padding: 12 }}>
        {q.trim() ? (
          // ====== 搜索结果 ======
          results.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'var(--app-colorTextSecondary, #6b7280)' }}>
              没有匹配结果
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
                      padding: '12px 14px',
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: idx === active ? 'var(--app-colorPrimary, #1677ff)' : 'transparent',
                      color: idx === active ? '#fff' : 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 14, textAlign: 'left' }}>{r.title}</span>
                    <span style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap' }}>{r.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          // ====== 收藏 + 历史（空搜索时显示） ======
          <div>
            {favEntries.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: 'var(--app-colorTextTertiary, #888)', padding: '4px 4px 8px' }}>
                  收藏
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: 8 }}>
                  {favEntries.map((r, idx) => (
                    <li key={`fav-${r.path}`}>
                      <button
                        onClick={() => go(r)}
                        onMouseEnter={() => setActive(idx)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 14px',
                          border: 'none',
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: idx === active ? 'var(--app-colorPrimary, #1677ff)' : 'transparent',
                          color: idx === active ? '#fff' : 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{r.title}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>{r.path}</span>
                          <span
                            onClick={e => {
                              e.stopPropagation()
                              toggleFav(r)
                            }}
                            title="取消收藏"
                            style={{ fontSize: 14, opacity: 0.95 }}
                          >
                            ★
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div style={{ fontSize: 13, color: 'var(--app-colorTextTertiary, #888)', padding: '4px 4px 8px' }}>
              搜索历史
            </div>
            {historyEntries.length === 0 ? (
              <div style={{ padding: '12px 14px', color: 'var(--app-colorTextSecondary, #6b7280)' }}>
                暂无历史，试着输入关键字…
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {historyEntries.map((r, idx) => {
                  const listIndex = favEntries.length + idx
                  return (
                    <li key={`his-${r.path}`}>
                      <button
                        onClick={() => go(r)}
                        onMouseEnter={() => setActive(listIndex)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 14px',
                          border: 'none',
                          borderRadius: 10,
                          cursor: 'pointer',
                          background:
                            listIndex === active ? 'var(--app-colorPrimary, #1677ff)' : 'transparent',
                          color: listIndex === active ? '#fff' : 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{r.title}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>{r.path}</span>
                          <span
                            onClick={e => {
                              e.stopPropagation()
                              toggleFav(r)
                            }}
                            title={favs.includes(r.path) ? '取消收藏' : '收藏'}
                            style={{ fontSize: 14, opacity: 0.95 }}
                          >
                            {favs.includes(r.path) ? '★' : '☆'}
                          </span>
                          <span
                            onClick={e => {
                              e.stopPropagation()
                              removeHistory(r)
                            }}
                            title="移除"
                            style={{ fontSize: 16, lineHeight: 1, opacity: 0.6 }}
                          >
                            ×
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 底部快捷键提示 */}
      <div
        style={{
          borderTop: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
          padding: '10px 12px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          color: 'var(--app-colorTextSecondary, #6b7280)',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Kbd>↵</Kbd> 确认
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> 切换
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Kbd>ESC</Kbd> 关闭
        </div>
      </div>
    </Modal>
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
  const name = getDisplayName(user)
  const email = user?.email || ''
  const items: MenuProps['items'] = [
  
    { key: 'settings', icon: <Settings size={16} />, label: '账户设置' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogOut size={16} />, label: '退出登录', danger: true },
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
          {/* <Tooltip title={email}>
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
          </Tooltip> */}
        </div>
        <ChevronDown size={16} style={{ opacity: 0.7 }} />
      </button>
    </Dropdown>
  )
}

/* =============== 通知 =============== */
function useNotifications() {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()

  const loadAll = async () => {
    try {
      setLoading(true)
      const resp: any = await api.get('/notifications')
      const data = (resp?.success ? resp.data : resp) || {}
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(Number(data.unreadCount ?? 0))
    } catch (e: any) {
      console.error('加载通知错误:', e)
      message.error(e?.message || t('error.load_notifications'))
    } finally {
      setLoading(false)
    }
  }

  const loadUnread = async () => {
    try {
      const resp: any = await api.get('/notifications/unread-count')
      const data = (resp?.success ? resp.data : resp) || {}
      setUnreadCount(Number(data.unreadCount ?? 0))
    } catch (e: any) {
      console.error('加载未读通知数量错误:', e)
      setUnreadCount(0)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {
      console.error('标记通知为已读错误:', e)
    }
  }

  return { notifications, unreadCount, loading, loadAll, loadUnread, markAsRead }
}

function NotificationsBell({ themeMode }: { themeMode: 'light' | 'dark' }) {
  const { notifications, unreadCount, loading, loadAll, loadUnread, markAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUnread()
  }, [])

  useEffect(() => {
    if (!open) return
    loadAll()
  }, [open])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <IconButton title="通知" aria-label="通知" onClick={() => setOpen(s => !s)} themeMode={themeMode}>
        <Bell />
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
      </IconButton>

      {open && (
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
              {loading ? (
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
                        ? themeMode === 'dark'
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
  const { language, setLanguage } = useLanguage()

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
      message.error('退出登录失败')
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
          {language === 'zh-CN' ? '✓ ' : ''}简体中文
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
        borderBottom: '1px solid var(--app-colorSplit, #e5e7eb)',
        backgroundColor: 'var(--app-colorBgElevated, rgba(255,255,255,.95))',
        color: 'var(--app-colorText, #111827)',
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
          ) : null}

          {mode !== 'side' && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <TopNav />
            </div>
          )}
        </div>

        {/* 右区 */}
        <nav style={{ display: 'grid', gridAutoFlow: 'column', alignItems: 'center', gap: 12 }}>
          <IconButton
            themeMode={themeMode}
            title="搜索 (Ctrl/⌘+K)"
            aria-label="搜索"
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
              <IconButton themeMode={themeMode} title="语言 / Language" aria-label="语言切换">
                <Languages />
              </IconButton>
            </span>
          </Dropdown>
          <IconButton
            themeMode={themeMode}
            title={isFullscreen ? '退出全屏 (Esc)' : '全屏'}
            aria-label={isFullscreen ? '退出全屏' : '全屏'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
          <IconButton
            themeMode={themeMode}
            title={themeMode === 'dark' ? '切换到浅色' : '切换到深色'}
            aria-label={themeMode === 'dark' ? '切换到浅色' : '切换到深色'}
            onClick={toggle}
          >
            {themeMode === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
          <IconButton
            themeMode={themeMode}
            title="系统配置"
            aria-label="系统配置"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings />
          </IconButton>
          <NotificationsBell themeMode={themeMode} />
          {/* 用户 */}
          <UserBadge
            user={user}
         
            onGoSettings={() => navigate('/settings')}
            onLogout={handleLogout}
          />
        </nav>
      </div>

      <LayoutSwitchDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
