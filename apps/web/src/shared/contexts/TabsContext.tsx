import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLayout } from '@/shared/contexts/LayoutContext'

export type TabItem = { key: string; title: string; closable?: boolean }

type Ctx = {
  tabs: TabItem[]
  activeKey: string
  addOrActivate: (tab: TabItem) => void
  closeTab: (key: string) => void
  closeOthers: (key: string) => void
  closeAll: () => void
  rename: (key: string, title: string) => void
}

const TabsContext = createContext<Ctx | null>(null)

const LS_LIST = 'tabs:v2:list'
const LS_ACTIVE = 'tabs:v2:active'

// 你的首页
const HOME_PATH = '/dashboard'

function normalizePath(p: string) {
  const raw = (p || '/').trim()
  if (raw === '/' || raw === '') return HOME_PATH
  const noTrail = raw.replace(/\/+$/, '')
  return noTrail || HOME_PATH
}

function titleFromPath(p: string) {
  const np = normalizePath(p)
  if (np === HOME_PATH) return '仪表盘'
  const seg = decodeURIComponent(np.split('/').pop() || '')
  return seg || np
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { persistTabs } = useLayout() // ← 新增：是否持久化

  const [tabs, setTabs] = useState<TabItem[]>([])
  const [activeKey, setActiveKey] = useState<string>('')

  const programNavRef = useRef(false)

  const load = useCallback(() => {
    if (!persistTabs) return { list: [] as TabItem[], a: '' }
    try {
      const listRaw = localStorage.getItem(LS_LIST)
      const activeRaw = localStorage.getItem(LS_ACTIVE)
      const list = listRaw ? (JSON.parse(listRaw) as TabItem[]) : []
      const a = typeof activeRaw === 'string' ? activeRaw : ''
      return { list, a }
    } catch {
      return { list: [], a: '' }
    }
  }, [persistTabs])

  const persist = useCallback(
    (list: TabItem[], a: string) => {
      if (!persistTabs) {
        try {
          localStorage.removeItem(LS_LIST)
          localStorage.removeItem(LS_ACTIVE)
        } catch {}
        return
      }
      try {
        localStorage.setItem(LS_LIST, JSON.stringify(list))
        localStorage.setItem(LS_ACTIVE, a || '')
      } catch {}
    },
    [persistTabs]
  )

  // 切换持久化开关时，重置一次初始态
  useEffect(() => {
    const { list, a } = load()
    const cur = normalizePath(location.pathname || '/')

    const mergedMap = new Map<string, TabItem>()
    for (const t of list) {
      const k = normalizePath(t.key)
      mergedMap.set(k, { key: k, title: t.title || titleFromPath(k), closable: k !== HOME_PATH })
    }
    let merged = Array.from(mergedMap.values())

    if (!merged.length) {
      const first: TabItem = { key: cur, title: titleFromPath(cur), closable: cur !== HOME_PATH }
      merged = [first]
      setTabs(merged)
      setActiveKey(cur)
      persist(merged, cur)
    } else {
      const active = normalizePath(a || merged[0]?.key || cur)
      setTabs(merged)
      setActiveKey(active)
      persist(merged, active)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistTabs]) // ← 监听开关

  // 路由变化 -> 同步标签
  useEffect(() => {
    if (programNavRef.current) programNavRef.current = false
    const cur = normalizePath(location.pathname || '/')
    setActiveKey(prev => (prev === cur ? prev : cur))
    setTabs(prev => {
      if (prev.some(t => t.key === cur)) {
        const next = prev.map(t => (t.key === cur && !t.title ? { ...t, title: titleFromPath(cur) } : t))
        persist(next, cur)
        return next
      }
      const t: TabItem = { key: cur, title: titleFromPath(cur), closable: cur !== HOME_PATH }
      const next = [...prev, t]
      persist(next, cur)
      return next
    })
  }, [location.pathname, persist])

  const addOrActivate = useCallback(
    (tab: TabItem) => {
      const path = normalizePath(tab.key)
      const tabFixed: TabItem = {
        ...tab,
        key: path,
        title: tab.title || titleFromPath(path),
        closable: path !== HOME_PATH,
      }
      setTabs(prev => {
        const exists = prev.some(t => t.key === path)
        const next = exists ? prev.map(t => (t.key === path ? { ...t, ...tabFixed } : t)) : [...prev, tabFixed]
        persist(next, path)
        return next
      })
      setActiveKey(path)
      if (normalizePath(location.pathname) !== path) {
        programNavRef.current = true
        navigate(path)
      }
    },
    [location.pathname, navigate, persist]
  )

  const closeTab = useCallback(
    (key: string) => {
      const k = normalizePath(key)
      setTabs(prev => {
        const idx = prev.findIndex(t => t.key === k)
        if (idx === -1) return prev
        const next = prev.filter(t => t.key !== k)
        let nextActive = activeKey

        if (k === activeKey) {
          const fallback = next[idx - 1]?.key || next[idx]?.key || HOME_PATH
          nextActive = fallback
          if (normalizePath(location.pathname) !== fallback) {
            programNavRef.current = true
            navigate(fallback)
          }
        }
        persist(next, nextActive)
        setActiveKey(nextActive)
        return next
      })
    },
    [activeKey, location.pathname, navigate, persist]
  )

  const closeOthers = useCallback(
    (key: string) => {
      const target = normalizePath(key)
      setTabs(prev => {
        const me = prev.find(t => t.key === target)
        const next = me ? [me] : [{ key: HOME_PATH, title: titleFromPath(HOME_PATH), closable: false }]
        const to = me ? me.key : HOME_PATH
        if (normalizePath(location.pathname) !== to) {
          programNavRef.current = true
          navigate(to)
        }
        persist(next, to)
        setActiveKey(to)
        return next
      })
    },
    [location.pathname, navigate, persist]
  )

  const closeAll = useCallback(() => {
    const home = HOME_PATH
    const only = [{ key: home, title: titleFromPath(home), closable: false }]
    setTabs(only)
    setActiveKey(home)
    persist(only, home)
    if (normalizePath(location.pathname) !== home) {
      programNavRef.current = true
      navigate(home)
    }
  }, [location.pathname, navigate, persist])

  const rename = useCallback(
    (key: string, title: string) => {
      const k = normalizePath(key)
      setTabs(prev => {
        const next = prev.map(t => (t.key === k ? { ...t, title } : t))
        persist(next, activeKey)
        return next
      })
    },
    [activeKey, persist]
  )

  const value: Ctx = useMemo(
    () => ({ tabs, activeKey, addOrActivate, closeTab, closeOthers, closeAll, rename }),
    [tabs, activeKey, addOrActivate, closeTab, closeOthers, closeAll, rename]
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
