// src/shared/components/Header.tsx
import { App, Avatar, Dropdown, Input, Modal, Spin, Tabs, Badge, Empty, Tooltip, type MenuProps } from 'antd'
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
import * as pinyin from 'tiny-pinyin'

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
import { withAppAssetPath, withAppBasePath } from '@/shared/router/basePath'
import './css/header.css'

const HEADER_HEIGHT = 48
const HAN_REGEX = /[\u4e00-\u9fff]/
const TOKEN_SPLIT_REGEX = /[\/\s\-\._:]+/

type MenuEntry = {
  id: number
  title: string
  path: string
  keywords: string[]
}

type MenuHistoryEntry = Pick<MenuEntry, 'id' | 'title' | 'path'>

let cachedPinyinSupport: boolean | null = null

const hasDynamic = (p?: string | null) => !!p && /[:\[\{]/.test(p || '')

const ensurePinyinSupport = () => {
  if (cachedPinyinSupport != null) return cachedPinyinSupport
  if (typeof window === 'undefined') return false
  try {
    cachedPinyinSupport = typeof Intl !== 'undefined' && pinyin.isSupported()
  } catch {
    cachedPinyinSupport = false
  }
  return cachedPinyinSupport ?? false
}

const tokenizePinyin = (value: string): string[] => {
  if (!HAN_REGEX.test(value) || !ensurePinyinSupport()) return []
  try {
    const wordsRaw = pinyin.convertToPinyin(value, ' ', true)
    if (!wordsRaw) return []
    const words = wordsRaw.split(/\s+/).filter(Boolean)
    if (!words.length) return []

    const tokens = new Set<string>()
    words.forEach(w => tokens.add(w))
    tokens.add(words.join(''))

    const initials = words.map(w => w[0]).join('')
    if (initials) tokens.add(initials)

    return Array.from(tokens)
  } catch {
    return []
  }
}

const expandToken = (input: string): string[] => {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return []

  const baseTokens = new Set<string>()
  baseTokens.add(trimmed)

  const fragments = trimmed.split(TOKEN_SPLIT_REGEX).map(f => f.trim()).filter(Boolean)
  fragments.forEach(f => baseTokens.add(f))

  const lowered = Array.from(baseTokens).map(token => token.toLowerCase())
  const finalTokens = new Set<string>(lowered)

  lowered.forEach(token => {
    tokenizePinyin(token).forEach(py => finalTokens.add(py))
  })

  return Array.from(finalTokens).filter(Boolean)
}

const buildMenuKeywords = (menu: MenuItem, path: string): string[] => {
  const rawTokens = new Set<string>()
  const push = (val?: string | null) => {
    if (!val) return
    rawTokens.add(val)
  }

  push(menu.title)
  push(menu.name)
  push(menu.component as string)
  push((menu as any).permission_code)
  push(path)

  if (path) {
    path
      .split('/')
      .filter(Boolean)
      .forEach(seg => push(seg))
  }

  const meta = (menu as any).meta
  if (meta) {
    const metaKeywords = meta.keywords ?? meta.keyword ?? meta.alias ?? meta.aliases
    if (typeof metaKeywords === 'string') {
      metaKeywords
        .split(/[,，;\s]+/)
        .map((kw: string) => kw.trim())
        .filter(Boolean)
        .forEach(push)
    } else if (Array.isArray(metaKeywords)) {
      metaKeywords
        .map(String)
        .map(kw => kw.trim())
        .filter(Boolean)
        .forEach(push)
    }
  }

  const tokens = new Set<string>()
  rawTokens.forEach(token => {
    expandToken(token).forEach(t => tokens.add(t))
  })

  return Array.from(tokens)
}

const computeMatchScore = (entry: MenuEntry, queryParts: string[]): number | null => {
  if (!queryParts.length) return null
  let total = 0

  for (const part of queryParts) {
    let best: number | null = null

    for (const token of entry.keywords) {
      const idx = token.indexOf(part)
      if (idx === -1) continue

      const lengthPenalty = Math.max(0, token.length - part.length)
      const positionPenalty = idx === 0 ? 0 : idx * 2
      const candidate = positionPenalty + lengthPenalty

      if (best === null || candidate < best) best = candidate
      if (best === 0) break
    }

    if (best === null) return null
    total += best
  }

  return total + entry.title.length * 0.001
}

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
          out.push({
            id: (m as any).id,
            title: (m as any).title,
            path,
            keywords: buildMenuKeywords(m as any, path),
          })
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
        background: 'var(--surface-1, #fff)',
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
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const { menus } = useMenuPermissions()
  const { addOrActivate } = useTabs()
  const entries = useMemo(() => flattenMenus(menus), [menus])

  const HISTORY_KEY = 'cmdp:history'
  const FAV_KEY = 'cmdp:favorites'

  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [history, setHistory] = useState<MenuHistoryEntry[]>([])
  const [favs, setFavs] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  const loadPersist = useCallback(() => {
    try {
      const hs = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as MenuHistoryEntry[]
      const fs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[]
      setHistory(Array.isArray(hs) ? hs : [])
      setFavs(Array.isArray(fs) ? fs : [])
    } catch {
      setHistory([])
      setFavs([])
    }
  }, [])

  const saveHistory = useCallback((list: MenuHistoryEntry[]) => {
    setHistory(list)
    try {
      const persisted = list.slice(0, 12).map(item => ({ id: item.id, title: item.title, path: item.path }))
      localStorage.setItem(HISTORY_KEY, JSON.stringify(persisted))
    } catch {}
  }, [])

  const saveFavs = useCallback((list: string[]) => {
    setFavs(list)
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list))
    } catch {}
  }, [])

  useEffect(() => {
    if (!open) return
    loadPersist()
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open, loadPersist])

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

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return [] as MenuEntry[]
    const parts = kw.split(/\s+/).filter(Boolean)
    if (!parts.length) return [] as MenuEntry[]

    return entries
      .map(entry => {
        const score = computeMatchScore(entry, parts)
        return score == null ? null : { entry, score }
      })
      .filter((item): item is { entry: MenuEntry; score: number } => !!item)
      .sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title))
      .slice(0, 12)
      .map(item => item.entry)
  }, [q, entries])

  const favEntries = useMemo(
    () => favs.map(p => entries.find(e => e.path === p)).filter(Boolean) as MenuEntry[],
    [favs, entries]
  )
  const historyEntries = useMemo(() => {
    const ok = new Map(entries.map(e => [e.path, e]))
    return history.map(h => ok.get(h.path)).filter(Boolean) as MenuEntry[]
  }, [history, entries])

  const toHistoryEntry = (entry: MenuEntry): MenuHistoryEntry => ({
    id: entry.id,
    title: entry.title,
    path: entry.path,
  })

  const go = (entry: MenuEntry) => {
    addOrActivate({ key: entry.path, title: entry.title, closable: entry.path !== '/' })
    const next = [toHistoryEntry(entry), ...history.filter(h => h.path !== entry.path)]
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

  const removeHistory = (path: string) => {
    saveHistory(history.filter(h => h.path !== path))
  }

  const visibleList: MenuEntry[] = q.trim() ? results : [...favEntries, ...historyEntries]
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
      <div style={{ padding: 12, borderBottom: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-1, #fff)',
            border: '1px solid var(--app-colorSplit, rgba(0,0,0,.08))',
            borderRadius: 10,
            padding: '6px 10px',
          }}
        >
          <SearchIcon size={16} />
          <Input
            ref={inputRef as any}
            variant="borderless"
            placeholder={t('header.search_placeholder')}
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

      <div style={{ maxHeight: 420, overflowY: 'auto', padding: 12 }}>
        {q.trim() ? (
          results.length === 0 ? (
            <div style={{ padding: '24px 16px', color: 'var(--app-colorTextSecondary, #6b7280)' }}>{t('header.no_match')}</div>
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
          <div>
            {favEntries.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: 'var(--app-colorTextTertiary, #888)', padding: '4px 4px 8px' }}>
                  {t('header.favorites')}
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
                            title={t('header.unfavorite')}
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
              {t('header.search_history')}
            </div>
            {historyEntries.length === 0 ? (
              <div style={{ padding: '12px 14px', color: 'var(--app-colorTextSecondary, #6b7280)' }}>
                {t('header.no_history')}
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
                          background: listIndex === active ? 'var(--app-colorPrimary, #1677ff)' : 'transparent',
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
                            title={favs.includes(r.path) ? t('header.unfavorite') : t('header.favorite')}
                            style={{ fontSize: 14, opacity: 0.95 }}
                          >
                            {favs.includes(r.path) ? '★' : '☆'}
                          </span>
                          <span
                            onClick={e => {
                              e.stopPropagation()
                              removeHistory(r.path)
                            }}
                            title={t('header.remove')}
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
          <Kbd>↵</Kbd> {t('header.kbd_enter')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> {t('header.kbd_switch')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Kbd>ESC</Kbd> {t('header.kbd_close')}
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
