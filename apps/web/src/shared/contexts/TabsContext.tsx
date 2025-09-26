// src/shared/contexts/TabsContext.tsx
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'

export type TabItem = { key: string; title: string; closable?: boolean }

type TabsContextValue = {
  tabs: TabItem[]
  activeKey: string
  addOrActivate: (tab: TabItem) => void
  remove: (key: string) => void
  setActiveKey: (key: string) => void
  clear: () => void
  closeOthers: (keepKey: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)
const STORAGE_KEY = 'app_tabs_state_v1'

// ===== Dashboard 归一规则：'/' 与 '/dashboard' 认为同一标签 =====
const DASHBOARD_CANON = '/dashboard'
const DASHBOARD_ALIASES = new Set<string>(['/', '/dashboard'])
const isDashboard = (p?: string) => !!p && DASHBOARD_ALIASES.has(p)
const normalizePath = (p?: string) => (isDashboard(p) ? DASHBOARD_CANON : p || '/')

// ====== 全局单例，防止 Provider 重挂载时“读到旧快照” ======
type GlobalTabsState = { tabs: TabItem[]; activeKey: string } | null
declare global {
  interface Window {
    __APP_TABS_STATE__?: GlobalTabsState
  }
}
const getGlobal = (): GlobalTabsState => window.__APP_TABS_STATE__ ?? null
const setGlobal = (state: GlobalTabsState) => (window.__APP_TABS_STATE__ = state)

function loadFromStorage(): GlobalTabsState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.tabs)) return parsed
  } catch {}
  return null
}
function saveToStorage(payload: { tabs: TabItem[]; activeKey: string }) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {}
}

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { flatMenus } = useMenuPermissions()

  // 安全跳转（放到微任务）
  const safeNav = React.useCallback(
    (to: string) => {
      const target = normalizePath(to)
      if (!target || target === normalizePath(pathname)) return
      Promise.resolve().then(() => {
        if (target !== normalizePath(window.location.pathname)) navigate(target)
      })
    },
    [navigate, pathname]
  )

  // 菜单 path -> 中文标题
  const pathTitleMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const m of flatMenus || []) {
      if (m?.path && m?.title && !m.is_hidden) {
        const k = normalizePath(m.path)
        map.set(k, m.title)
        if (isDashboard(m.path)) {
          map.set('/', m.title)
          map.set('/dashboard', m.title)
        }
      }
    }
    return map
  }, [flatMenus])

  const resolveTitle = React.useCallback(
    (path: string) => {
      const k = normalizePath(path)
      if (pathTitleMap.has(k)) return pathTitleMap.get(k)!
      if (k === DASHBOARD_CANON) return 'Dashboard'
      const last = k.split('/').filter(Boolean).pop() || 'page'
      const t = last.replace(/[-_]/g, ' ')
      return t.charAt(0).toUpperCase() + t.slice(1)
    },
    [pathTitleMap]
  )

  // —— 初始：优先内存单例，其次 storage，最后默认值 —— //
  const initial = React.useMemo(() => {
    const fromGlobal = getGlobal()
    if (fromGlobal) return fromGlobal

    const loaded = loadFromStorage()
    if (loaded) {
      // 归一化 + 确保 dashboard 存在
      const seen = new Set<string>()
      const normalized: TabItem[] = []
      for (const t of loaded.tabs) {
        const k = normalizePath(t.key)
        if (seen.has(k)) continue
        seen.add(k)
        normalized.push({
          key: k,
          title: k === DASHBOARD_CANON ? pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard' : t.title || '',
          closable: k === DASHBOARD_CANON ? false : t.closable !== false,
        })
      }
      if (!seen.has(DASHBOARD_CANON)) {
        normalized.unshift({
          key: DASHBOARD_CANON,
          title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard',
          closable: false,
        })
      }
      const active = normalizePath(loaded.activeKey || pathname || DASHBOARD_CANON)
      const state = { tabs: normalized, activeKey: active }
      setGlobal(state)
      return state
    }

    const fallback = {
      tabs: [{ key: DASHBOARD_CANON, title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard', closable: false }],
      activeKey: normalizePath(pathname) || DASHBOARD_CANON,
    }
    setGlobal(fallback)
    return fallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 仅首次

  const [tabs, setTabs] = React.useState<TabItem[]>(initial!.tabs)
  const [activeKey, setActiveKeyState] = React.useState<string>(initial!.activeKey)

  // 统一持久化（也写入全局单例）
  const persist = React.useCallback(
    (nextTabs: TabItem[], nextActive: string) => {
      const seen = new Set<string>()
      const clean = nextTabs
        .map(t => {
          const k = normalizePath(t.key)
          return {
            key: k,
            title: k === DASHBOARD_CANON ? pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard' : t.title || '',
            closable: k === DASHBOARD_CANON ? false : t.closable !== false,
          }
        })
        .filter(t => (seen.has(t.key) ? false : (seen.add(t.key), true)))

      if (!seen.has(DASHBOARD_CANON)) {
        clean.unshift({
          key: DASHBOARD_CANON,
          title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard',
          closable: false,
        })
      }

      const payload = { tabs: clean, activeKey: normalizePath(nextActive) }
      setGlobal(payload) // ✅ 同步到内存单例
      saveToStorage(payload) // ✅ 再写入 storage
    },
    [pathTitleMap]
  )

  // 防抖：清空/只留仪表盘时，屏蔽下一轮 pathname 自动加签
  const suppressNextAutoAddRef = React.useRef(false)

  const setActiveKey = React.useCallback(
    (key: string) => {
      const k = normalizePath(key)
      setActiveKeyState(k)
      persist(tabs, k)
      safeNav(k)
    },
    [persist, tabs, safeNav]
  )

  const addOrActivate = React.useCallback(
    (tab: TabItem) => {
      const k = normalizePath(tab.key)
      setTabs(prev => {
        const exists = prev.some(t => normalizePath(t.key) === k)
        const finalized: TabItem = {
          key: k,
          title: tab.title || resolveTitle(k),
          closable: k === DASHBOARD_CANON ? false : tab.closable !== false,
        }
        const next = exists ? prev.map(t => (normalizePath(t.key) === k ? finalized : t)) : [...prev, finalized]
        setActiveKeyState(k)
        persist(next, k)
        safeNav(k)
        return next
      })
    },
    [persist, resolveTitle, safeNav]
  )

  const remove = React.useCallback(
    (key: string) => {
      const k = normalizePath(key)
      if (k === DASHBOARD_CANON) return
      setTabs(prev => {
        const idx = prev.findIndex(t => normalizePath(t.key) === k)
        if (idx === -1) return prev
        const next = prev.filter(t => normalizePath(t.key) !== k)

        if (normalizePath(activeKey) === k) {
          const fb = next[idx - 1] ||
            next[idx] || { key: DASHBOARD_CANON, title: resolveTitle(DASHBOARD_CANON), closable: false }
          const fbKey = normalizePath(fb.key)
          setActiveKeyState(fbKey)
          persist(next, fbKey)
          safeNav(fbKey)
        } else {
          persist(next, activeKey)
        }
        return next
      })
    },
    [activeKey, persist, safeNav, resolveTitle]
  )

  const closeOthers = React.useCallback(
    (keepKey: string) => {
      const k = normalizePath(keepKey || activeKey)
      const kept: TabItem[] =
        k === DASHBOARD_CANON
          ? [{ key: DASHBOARD_CANON, title: resolveTitle(DASHBOARD_CANON), closable: false }]
          : [
              { key: DASHBOARD_CANON, title: resolveTitle(DASHBOARD_CANON), closable: false },
              { key: k, title: resolveTitle(k), closable: true },
            ]
      suppressNextAutoAddRef.current = true
      setTabs(kept)
      setActiveKeyState(k)
      persist(kept, k)
      safeNav(k)
    },
    [activeKey, persist, safeNav, resolveTitle]
  )

  const clear = React.useCallback(() => {
    const onlyDash: TabItem[] = [{ key: DASHBOARD_CANON, title: resolveTitle(DASHBOARD_CANON), closable: false }]
    suppressNextAutoAddRef.current = true
    setTabs(onlyDash)
    setActiveKeyState(DASHBOARD_CANON)
    persist(onlyDash, DASHBOARD_CANON)
    safeNav(DASHBOARD_CANON)
  }, [persist, safeNav, resolveTitle])

  // 菜单准备好后，纠正中文标题并持久化
  React.useEffect(() => {
    setTabs(prev => {
      let changed = false
      const updated = prev.map(t => {
        const k = normalizePath(t.key)
        const menuTitle = pathTitleMap.get(k)
        if (menuTitle && t.title !== menuTitle) {
          changed = true
          return { ...t, title: menuTitle, closable: k === DASHBOARD_CANON ? false : t.closable !== false }
        }
        return t
      })
      if (changed) {
        persist(updated, activeKey)
        return updated
      }
      return prev
    })
  }, [pathTitleMap, activeKey, persist])

  // 路由变化：自动加签（带 suppress）
  React.useEffect(() => {
    const key = normalizePath(pathname)
    if (suppressNextAutoAddRef.current) {
      suppressNextAutoAddRef.current = false
      setActiveKeyState(key)
      persist(
        tabs.length ? tabs : [{ key: DASHBOARD_CANON, title: resolveTitle(DASHBOARD_CANON), closable: false }],
        key
      )
      return
    }
    setTabs(prev => {
      const exists = prev.some(t => normalizePath(t.key) === key)
      if (exists) {
        const fixed = prev.map(t =>
          normalizePath(t.key) === key
            ? {
                key,
                title: t.title || resolveTitle(key),
                closable: key === DASHBOARD_CANON ? false : t.closable !== false,
              }
            : t
        )
        if (normalizePath(activeKey) !== key) {
          setActiveKeyState(key)
          persist(fixed, key)
        } else {
          persist(fixed, key)
        }
        return fixed
      }
      const next = [...prev, { key, title: resolveTitle(key), closable: key === DASHBOARD_CANON ? false : true }]
      setActiveKeyState(key)
      persist(next, key)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, resolveTitle])

  const value = React.useMemo<TabsContextValue>(
    () => ({ tabs, activeKey, addOrActivate, remove, setActiveKey, clear, closeOthers }),
    [tabs, activeKey, addOrActivate, remove, setActiveKey, clear, closeOthers]
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
