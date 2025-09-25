// src/shared/contexts/TabsContext.tsx
import { useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type TabItem = { key: string; title: string; closable?: boolean }

type TabsContextValue = {
  tabs: TabItem[]
  activeKey: string
  addOrActivate: (tab: TabItem) => void
  remove: (key: string) => void
  setActiveKey: (key: string) => void
  clear: () => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)
const STORAGE_KEY = 'app_tabs_state_v1'

// ============ Dashboard 合并策略 ============
// 将 "/" 与 "/dashboard" 识别为同一路由标签（canonical）
const DASHBOARD_CANON = '/dashboard'
const DASHBOARD_ALIASES = new Set<string>(['/', '/dashboard'])

const isDashboard = (p?: string) => !!p && DASHBOARD_ALIASES.has(p)
const normalizePath = (p?: string) => (isDashboard(p) ? DASHBOARD_CANON : p || '/')

function loadFromStorage(): { tabs: TabItem[]; activeKey: string } | null {
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

  // 统一“安全跳转”：放到微任务，避免渲染期更新 Router
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

  // 构建 path->中文标题 映射
  const pathTitleMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const m of flatMenus || []) {
      if (m?.path && m?.title && !m.is_hidden) {
        // 也为 "/" 写入 dashboard 的标题，便于 alias 查到同一个标题
        const key = normalizePath(m.path)
        map.set(key, m.title)
        if (isDashboard(m.path)) {
          map.set('/', m.title)
          map.set('/dashboard', m.title)
        }
      }
    }
    return map
  }, [flatMenus])

  // 标题解析（优先菜单中文）
  const resolveTitle = React.useCallback(
    (path: string) => {
      const key = normalizePath(path)
      if (pathTitleMap.has(key)) return pathTitleMap.get(key)!
      // 兜底为 'Dashboard'（因为首页合并成 Dashboard 了）
      if (key === DASHBOARD_CANON) return 'Dashboard'
      // 其它路径兜底英文格式化
      const last = key.split('/').filter(Boolean).pop() || 'page'
      const t = last.replace(/[-_]/g, ' ')
      return t.charAt(0).toUpperCase() + t.slice(1)
    },
    [pathTitleMap]
  )

  // 初始化：把存储里的 "/" 归一到 "/dashboard"，去重，并确保 dashboard 存在且不可关闭
  const initial = React.useMemo(() => {
    const loaded = loadFromStorage()
    if (!loaded) return null
    const seen = new Set<string>()
    const normalizedTabs: TabItem[] = []
    for (const t of loaded.tabs as TabItem[]) {
      const key = normalizePath(t.key)
      if (seen.has(key)) continue
      seen.add(key)
      normalizedTabs.push({
        key,
        title: key === DASHBOARD_CANON ? pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard' : t.title || '',
        closable: key === DASHBOARD_CANON ? false : t.closable !== false, // dashboard 强制不可关
      })
    }
    if (!seen.has(DASHBOARD_CANON)) {
      normalizedTabs.unshift({
        key: DASHBOARD_CANON,
        title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard',
        closable: false,
      })
    }
    const active = normalizePath(loaded.activeKey || pathname || DASHBOARD_CANON)
    return { tabs: normalizedTabs, activeKey: active }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 初次构建即可

  const [tabs, setTabs] = React.useState<TabItem[]>(
    initial?.tabs?.length
      ? initial.tabs
      : [
          {
            key: DASHBOARD_CANON,
            title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard',
            closable: false,
          },
        ]
  )
  const [activeKey, setActiveKeyState] = React.useState<string>(
    initial?.activeKey || normalizePath(pathname) || DASHBOARD_CANON
  )

  const persist = React.useCallback(
    (nextTabs: TabItem[], nextActive: string) => {
      // 持久化前也做一次归一 & 去重，确保干净
      const seen = new Set<string>()
      const clean = nextTabs
        .map(t => ({
          key: normalizePath(t.key),
          title: t.key === DASHBOARD_CANON ? pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard' : t.title || '',
          closable: t.key === DASHBOARD_CANON ? false : t.closable !== false,
        }))
        .filter(t => (seen.has(t.key) ? false : (seen.add(t.key), true)))

      if (!seen.has(DASHBOARD_CANON)) {
        clean.unshift({
          key: DASHBOARD_CANON,
          title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard',
          closable: false,
        })
      }
      saveToStorage({ tabs: clean, activeKey: normalizePath(nextActive) })
    },
    [pathTitleMap]
  )

  // 一次性屏蔽：清空/删到只剩 dashboard 时，阻止下一轮 pathname 触发“自动新增”
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
        const title = tab.title || resolveTitle(k)
        const finalized: TabItem = {
          key: k,
          title,
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
      if (k === DASHBOARD_CANON) {
        // Dashboard 不允许关闭
        return
      }
      setTabs(prev => {
        const idx = prev.findIndex(t => normalizePath(t.key) === k)
        if (idx === -1) return prev
        const next = prev.filter(t => normalizePath(t.key) !== k)

        if (normalizePath(activeKey) === k) {
          // 激活页被删
          const fallback = next[idx - 1] ||
            next[idx] || {
              key: DASHBOARD_CANON,
              title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard',
              closable: false,
            }
          const fbKey = normalizePath(fallback.key)
          setActiveKeyState(fbKey)
          persist(next, fbKey)
          safeNav(fbKey)
        } else {
          persist(next, activeKey)
        }
        return next
      })
    },
    [activeKey, persist, safeNav, pathTitleMap]
  )

  const clear = React.useCallback(() => {
    suppressNextAutoAddRef.current = true
    const onlyDash: TabItem[] = [
      { key: DASHBOARD_CANON, title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard', closable: false },
    ]
    setTabs(onlyDash)
    setActiveKeyState(DASHBOARD_CANON)
    persist(onlyDash, DASHBOARD_CANON)
    safeNav(DASHBOARD_CANON)
  }, [persist, safeNav, pathTitleMap])
  // 放在 TabsProvider 内其他 hooks 之后（比如在路由副作用 useEffect 下面或上面都行）
  React.useEffect(() => {
    // 菜单映射 ready 时，纠正已存在标签标题（尤其是 /dashboard）
    setTabs(prev => {
      let changed = false
      const updated = prev.map(t => {
        const k = normalizePath(t.key)
        const menuTitle = pathTitleMap.get(k)
        // 只要菜单里有标题，且与当前不同，就以菜单中文为准
        if (menuTitle && t.title !== menuTitle) {
          changed = true
          return {
            ...t,
            title: menuTitle,
            // 再确保 dashboard 不可关闭
            closable: k === DASHBOARD_CANON ? false : t.closable !== false,
          }
        }
        return t
      })
      if (changed) {
        // 用当前 activeKey 持久化（也会把 dashboard 再次保证不可关闭）
        persist(updated, activeKey)
        return updated
      }
      return prev
    })
  }, [pathTitleMap, activeKey, persist])

  // 路由变化：自动加入/修正标题（带一次性屏蔽 + dashboard 归一）
  React.useEffect(() => {
    const key = normalizePath(pathname)

    if (suppressNextAutoAddRef.current) {
      suppressNextAutoAddRef.current = false
      setActiveKeyState(key)
      persist(
        tabs.length
          ? tabs
          : [{ key: DASHBOARD_CANON, title: pathTitleMap.get(DASHBOARD_CANON) || 'Dashboard', closable: false }],
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
      const newTab: TabItem = {
        key,
        title: resolveTitle(key),
        closable: key === DASHBOARD_CANON ? false : true,
      }
      const next = [...prev, newTab]
      setActiveKeyState(key)
      persist(next, key)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, resolveTitle])

  const value = React.useMemo(
    () => ({ tabs, activeKey, addOrActivate, remove, setActiveKey, clear }),
    [tabs, activeKey, addOrActivate, remove, setActiveKey, clear]
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
