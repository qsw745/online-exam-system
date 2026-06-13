import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type LayoutMode = 'side' | 'top' | 'mix'

type Ctx = {
  mode: LayoutMode
  setMode: (m: LayoutMode) => void

  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (c: boolean) => void

  /** 显示 Logo + 项目名称 */
  showBrand: boolean
  setShowBrand: (b: boolean) => void

  /** 显示标签页 */
  showTabs: boolean
  setShowTabs: (b: boolean) => void

  /** 标签页是否持久化（刷新后保留） */
  persistTabs: boolean
  setPersistTabs: (b: boolean) => void
}

const LayoutContext = createContext<Ctx | null>(null)

const LS_MODE = 'layout:mode'
const LS_COLLAPSED = 'layout:collapsed'
const LS_SHOW_BRAND = 'layout:showBrand'
const LS_SHOW_TABS = 'layout:showTabs'
const LS_PERSIST_TABS = 'layout:persistTabs'

/** 与侧栏联动的事件名（DynamicSidebar 里用到） */
export const SIDEBAR_EVENT = 'app:sidebar-collapsed'

function readBool(key: string, def: boolean) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return def
    return v === '1' || v === 'true'
  } catch {
    return def
  }
}

function writeBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {}
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>(() => {
    try {
      const v = localStorage.getItem(LS_MODE) as LayoutMode | null
      return v === 'side' || v === 'top' || v === 'mix' ? v : 'side'
    } catch {
      return 'side'
    }
  })

  const [collapsed, setCollapsedState] = useState<boolean>(() => readBool(LS_COLLAPSED, false))
  const [showBrand, setShowBrandState] = useState<boolean>(() => readBool(LS_SHOW_BRAND, true))
  const [showTabs, setShowTabsState] = useState<boolean>(() => readBool(LS_SHOW_TABS, true))
  const [persistTabs, setPersistTabsState] = useState<boolean>(() => readBool(LS_PERSIST_TABS, true))

  const setMode = useCallback((m: LayoutMode) => {
    setModeState(m)
    try {
      localStorage.setItem(LS_MODE, m)
    } catch {}
  }, [])

  const setCollapsed = useCallback((c: boolean) => {
    setCollapsedState(c)
    writeBool(LS_COLLAPSED, c)
    // 通知侧栏（DynamicSidebar）同步展开状态
    try {
      window.dispatchEvent(new CustomEvent(SIDEBAR_EVENT, { detail: { collapsed: c } }))
    } catch {}
  }, [])

  const toggleCollapsed = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])

  const setShowBrand = useCallback((b: boolean) => {
    setShowBrandState(b)
    writeBool(LS_SHOW_BRAND, b)
  }, [])

  const setShowTabs = useCallback((b: boolean) => {
    setShowTabsState(b)
    writeBool(LS_SHOW_TABS, b)
  }, [])

  const setPersistTabs = useCallback((b: boolean) => {
    setPersistTabsState(b)
    writeBool(LS_PERSIST_TABS, b)
  }, [])

  // 当切换为 top 布局时，自动展开侧栏避免“误折叠”
  useEffect(() => {
    if (mode === 'top' && collapsed) setCollapsed(false)
  }, [mode, collapsed, setCollapsed])

  const value = useMemo<Ctx>(
    () => ({
      mode,
      setMode,
      collapsed,
      toggleCollapsed,
      setCollapsed,
      showBrand,
      setShowBrand,
      showTabs,
      setShowTabs,
      persistTabs,
      setPersistTabs,
    }),
    [
      mode,
      setMode,
      collapsed,
      toggleCollapsed,
      setCollapsed,
      showBrand,
      setShowBrand,
      showTabs,
      setShowTabs,
      persistTabs,
      setPersistTabs,
    ]
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}
