// apps/web/src/shared/hooks/useTheme.tsx
import { useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

function getSystemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    return saved || 'system'
  })

  const isDark = useMemo(() => (mode === 'dark' ? true : mode === 'light' ? false : getSystemDark()), [mode])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem(STORAGE_KEY, mode)
  }, [isDark, mode])

  const toggle = () => setMode(m => (m === 'dark' ? 'light' : 'dark'))

  return { mode, setMode, toggle, isDark }
}
