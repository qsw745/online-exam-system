// 全局搜索命令面板（Ctrl+K）：菜单（拼音/首字母）+ 用户/试卷/任务跨实体搜索
import { Input, Modal, Spin } from 'antd'
import {
  ClipboardList,
  Compass,
  FileText,
  Search as SearchIcon,
  Star,
  UserRound,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as pinyin from 'tiny-pinyin'

import { papersApi } from '@/shared/api/endpoints/papers'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { usersApi } from '@/shared/api/endpoints/users'
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useMenuPermissions, type MenuItem } from '@/shared/contexts/MenuPermissionContext'
import { useTabs } from '@/shared/contexts/TabsContext'
import './css/search-palette.css'

const HAN_REGEX = /[一-鿿]/
const TOKEN_SPLIT_REGEX = /[\/\s\-\._:]+/
const HISTORY_KEY = 'cmdp:history'
const FAV_KEY = 'cmdp:favorites'
const REMOTE_MIN_CHARS = 2
const REMOTE_DEBOUNCE_MS = 300
const REMOTE_LIMIT = 5

type MenuEntry = {
  id: number
  title: string
  path: string
  breadcrumb: string[]
  keywords: string[]
}

type MenuHistoryEntry = Pick<MenuEntry, 'id' | 'title' | 'path'>

type RowKind = 'menu' | 'user' | 'paper' | 'task'

type Row = {
  kind: RowKind
  key: string
  title: string
  desc?: string
  breadcrumb?: string[]
  entry?: MenuEntry
  open: () => void
}

/* ---------- 拼音与匹配 ---------- */

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

/** 子序列模糊命中（容错：漏敲字符也能命中，惩罚较高） */
const subsequenceScore = (token: string, part: string): number | null => {
  let ti = 0
  for (let pi = 0; pi < part.length; pi++) {
    ti = token.indexOf(part[pi], ti)
    if (ti === -1) return null
    ti += 1
  }
  return 40 + Math.max(0, token.length - part.length)
}

const computeMatchScore = (entry: MenuEntry, queryParts: string[]): number | null => {
  if (!queryParts.length) return null
  let total = 0

  for (const part of queryParts) {
    let best: number | null = null

    for (const token of entry.keywords) {
      const idx = token.indexOf(part)
      if (idx !== -1) {
        const lengthPenalty = Math.max(0, token.length - part.length)
        const positionPenalty = idx === 0 ? 0 : idx * 2
        const candidate = positionPenalty + lengthPenalty
        if (best === null || candidate < best) best = candidate
        if (best === 0) break
        continue
      }
      // 直接子串未命中时，退化为子序列模糊匹配
      if (part.length >= 2) {
        const fuzzy = subsequenceScore(token, part)
        if (fuzzy != null && (best === null || fuzzy < best)) best = fuzzy
      }
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
  const walk = (nodes: MenuItem[], parents: string[]) => {
    for (const m of nodes || []) {
      if ((m as any).is_hidden) continue
      const title = String((m as any).title || '')
      const rawPath = (m as any).path
      if (rawPath && !hasDynamic(rawPath)) {
        const path = clean(rawPath)
        if (!seen.has(path)) {
          seen.add(path)
          out.push({
            id: (m as any).id,
            title,
            path,
            breadcrumb: parents,
            keywords: buildMenuKeywords(m as any, path),
          })
        }
      }
      const children = (m as any).children
      if (children?.length) walk(children, title ? [...parents, title] : parents)
    }
  }
  walk(ms, [])
  return out
}

/* ---------- 小部件 ---------- */

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

/** 高亮标题中与查询直接匹配的片段（拼音命中时不高亮） */
function Highlight({ text, query }: { text: string; query: string }) {
  const parts = query
    .toLowerCase()
    .split(/\s+/)
    .filter(p => p.length > 0)
  if (!parts.length) return <>{text}</>
  const lower = text.toLowerCase()
  let start = -1
  let len = 0
  for (const p of parts) {
    const idx = lower.indexOf(p)
    if (idx !== -1 && p.length > len) {
      start = idx
      len = p.length
    }
  }
  if (start === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, start + len)}</mark>
      {text.slice(start + len)}
    </>
  )
}

const ROW_ICONS: Record<RowKind, React.ReactNode> = {
  menu: <Compass size={15} />,
  user: <UserRound size={15} />,
  paper: <FileText size={15} />,
  task: <ClipboardList size={15} />,
}

/* ---------- 主组件 ---------- */

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const { menus } = useMenuPermissions()
  const { addOrActivate } = useTabs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const entries = useMemo(() => flattenMenus(menus), [menus])

  const role = String(user?.role || '')
  const canSearchUsers = role === 'admin'
  const canSearchPapers = role === 'admin' || role === 'teacher'

  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [history, setHistory] = useState<MenuHistoryEntry[]>([])
  const [favs, setFavs] = useState<string[]>([])
  const [remote, setRemote] = useState<{ users: any[]; papers: any[]; tasks: any[] }>({ users: [], papers: [], tasks: [] })
  const [remoteLoading, setRemoteLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
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

  /* 菜单本地匹配 */
  const menuResults = useMemo(() => {
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
      .slice(0, 8)
      .map(item => item.entry)
  }, [q, entries])

  /* 远程实体搜索（防抖） */
  useEffect(() => {
    const kw = q.trim()
    if (!open || kw.length < REMOTE_MIN_CHARS) {
      setRemote({ users: [], papers: [], tasks: [] })
      setRemoteLoading(false)
      return
    }
    let alive = true
    setRemoteLoading(true)
    const timer = window.setTimeout(async () => {
      const pickList = (resp: any, ...keys: string[]): any[] => {
        const d = resp?.data?.data ?? resp?.data ?? resp
        for (const k of [...keys, 'list', 'items', 'rows']) {
          if (Array.isArray(d?.[k])) return d[k]
        }
        return Array.isArray(d) ? d : []
      }
      const [u, p, tk] = await Promise.all([
        canSearchUsers ? usersApi.list({ search: kw, page: 1, limit: REMOTE_LIMIT }).catch(() => null) : null,
        canSearchPapers ? papersApi.list({ search: kw, page: 1, limit: REMOTE_LIMIT }).catch(() => null) : null,
        tasksApi.listMine({ search: kw, page: 1, limit: REMOTE_LIMIT } as any).catch(() => null),
      ])
      if (!alive) return
      setRemote({
        users: pickList(u, 'users').slice(0, REMOTE_LIMIT),
        papers: pickList(p, 'papers').slice(0, REMOTE_LIMIT),
        tasks: pickList(tk, 'tasks').slice(0, REMOTE_LIMIT),
      })
      setRemoteLoading(false)
    }, REMOTE_DEBOUNCE_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [q, open, canSearchUsers, canSearchPapers])

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

  const closeAndReset = () => {
    setQ('')
    setActive(0)
    onClose()
  }

  const goMenu = (entry: MenuEntry) => {
    addOrActivate({ key: entry.path, title: entry.title, closable: entry.path !== '/' })
    saveHistory([toHistoryEntry(entry), ...history.filter(h => h.path !== entry.path)])
    closeAndReset()
  }

  const goPath = (path: string) => {
    navigate(path)
    closeAndReset()
  }

  const usersPagePath = useMemo(
    () => entries.find(e => /\/users$/.test(e.path))?.path || '/admin/users',
    [entries]
  )

  const toggleFav = (entry: MenuEntry) => {
    const exists = favs.includes(entry.path)
    saveFavs(exists ? favs.filter(p => p !== entry.path) : [entry.path, ...favs])
  }

  const removeHistory = (path: string) => {
    saveHistory(history.filter(h => h.path !== path))
  }

  /* 组装可见行（按渲染顺序，供键盘导航） */
  const groups = useMemo(() => {
    const menuRow = (e: MenuEntry): Row => ({
      kind: 'menu',
      key: `menu-${e.path}`,
      title: e.title,
      desc: e.path,
      breadcrumb: e.breadcrumb,
      entry: e,
      open: () => goMenu(e),
    })

    if (!q.trim()) {
      const out: Array<{ label: string; rows: Row[] }> = []
      if (favEntries.length) out.push({ label: t('header.favorites'), rows: favEntries.map(menuRow) })
      out.push({ label: t('header.search_history'), rows: historyEntries.map(menuRow) })
      return out
    }

    const out: Array<{ label: string; rows: Row[] }> = []
    if (menuResults.length) out.push({ label: t('header.group_menus'), rows: menuResults.map(menuRow) })
    if (remote.tasks.length) {
      out.push({
        label: t('header.group_tasks'),
        rows: remote.tasks.map((item: any) => ({
          kind: 'task' as const,
          key: `task-${item.id}`,
          title: String(item.title || item.name || `#${item.id}`),
          desc: item.status ? String(item.status) : undefined,
          open: () => goPath(`/tasks/detail/${item.id}`),
        })),
      })
    }
    if (remote.papers.length) {
      out.push({
        label: t('header.group_papers'),
        rows: remote.papers.map((item: any) => ({
          kind: 'paper' as const,
          key: `paper-${item.id}`,
          title: String(item.title || `#${item.id}`),
          desc: item.question_count != null ? `${item.question_count} ${t('header.paper_questions_unit')}` : undefined,
          open: () => goPath(`/admin/paper-detail/${item.id}`),
        })),
      })
    }
    if (remote.users.length) {
      out.push({
        label: t('header.group_users'),
        rows: remote.users.map((item: any) => ({
          kind: 'user' as const,
          key: `user-${item.id}`,
          title: String(item.nickname || item.name || item.username || item.email || `#${item.id}`),
          desc: [item.email, item.role].filter(Boolean).join(' · ') || undefined,
          open: () => goPath(usersPagePath),
        })),
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, menuResults, remote, favEntries, historyEntries, t, usersPagePath])

  const visibleRows = useMemo(() => groups.flatMap(g => g.rows), [groups])

  useEffect(() => {
    setActive(0)
  }, [q, open])

  // 键盘选中项滚入视野
  useEffect(() => {
    const el = listRef.current?.querySelector('.sp-row--active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const hasQuery = !!q.trim()
  const showEmpty = hasQuery && !remoteLoading && visibleRows.length === 0

  let rowCursor = -1

  return (
    <Modal
      open={open}
      onCancel={closeAndReset}
      footer={null}
      width={680}
      centered
      destroyOnHidden
      getContainer={() => document.body}
      styles={{ content: { padding: 0, borderRadius: 12, overflow: 'hidden' }, body: { padding: 0 } }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))' }}>
        <div className="sp-box">
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
                setActive(s => Math.min(s + 1, Math.max(0, visibleRows.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive(s => Math.max(0, s - 1))
              } else if (e.key === 'Enter') {
                visibleRows[active]?.open()
              } else if (e.key === 'Escape') {
                closeAndReset()
              }
            }}
            style={{ height: 28 }}
            suffix={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
                {remoteLoading && <Spin size="small" />}
                <Kbd>Ctrl</Kbd>
                <span style={{ fontSize: 12, color: 'var(--app-colorTextTertiary, #999)' }}>+</span>
                <Kbd>K</Kbd>
              </span>
            }
          />
        </div>
      </div>

      <div className="sp-body" ref={listRef}>
        {showEmpty ? (
          <div className="sp-empty">{t('header.no_match')}</div>
        ) : !hasQuery && visibleRows.length === 0 ? (
          <div className="sp-empty">{t('header.no_history')}</div>
        ) : (
          groups.map(group => (
            <React.Fragment key={group.label}>
              {group.rows.length > 0 && <div className="sp-group__title">{group.label}</div>}
              <ul className="sp-group">
                {group.rows.map(row => {
                  rowCursor += 1
                  const idx = rowCursor
                  const isMenuRow = row.kind === 'menu' && !!row.entry
                  const faved = isMenuRow && favs.includes(row.entry!.path)
                  const inHistoryView = !hasQuery
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        className={`sp-row ${idx === active ? 'sp-row--active' : ''}`}
                        onClick={row.open}
                        onMouseEnter={() => setActive(idx)}
                      >
                        <span className="sp-row__icon">{ROW_ICONS[row.kind]}</span>
                        <span className="sp-row__main">
                          <span className="sp-row__title">
                            <Highlight text={row.title} query={q} />
                          </span>
                          <span className="sp-row__desc">
                            {row.breadcrumb?.length ? (
                              <>
                                {row.breadcrumb.map((b, i) => (
                                  <React.Fragment key={`${b}-${i}`}>
                                    {b}
                                    <span className="sp-row__crumb-sep">›</span>
                                  </React.Fragment>
                                ))}
                                {row.desc}
                              </>
                            ) : (
                              row.desc
                            )}
                          </span>
                        </span>
                        <span className="sp-row__actions">
                          {isMenuRow && (
                            <span
                              className={`sp-row__action ${faved ? 'sp-row__action--faved' : ''}`}
                              title={faved ? t('header.unfavorite') : t('header.favorite')}
                              onClick={e => {
                                e.stopPropagation()
                                toggleFav(row.entry!)
                              }}
                            >
                              <Star size={14} fill={faved ? 'currentColor' : 'none'} />
                            </span>
                          )}
                          {isMenuRow && inHistoryView && !favs.includes(row.entry!.path) && (
                            <span
                              className="sp-row__action"
                              title={t('header.remove')}
                              onClick={e => {
                                e.stopPropagation()
                                removeHistory(row.entry!.path)
                              }}
                            >
                              <X size={14} />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </React.Fragment>
          ))
        )}
      </div>

      <div className="sp-footer">
        <span className="sp-footer__hint">
          <Kbd>↵</Kbd> {t('header.kbd_enter')}
        </span>
        <span className="sp-footer__hint">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> {t('header.kbd_switch')}
        </span>
        <span className="sp-footer__hint">
          <Kbd>ESC</Kbd> {t('header.kbd_close')}
        </span>
        {hasQuery && visibleRows.length > 0 && (
          <span className="sp-footer__count">
            {visibleRows.length} {t('header.results_unit')}
          </span>
        )}
      </div>
    </Modal>
  )
}
