import { Capacitor } from '@capacitor/core'
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react'

import { resolveAppTarget } from '@/platform/appTarget'

import { capacitorRuntime } from './capacitorRuntime'
import type { RuntimeAdapter, RuntimeSnapshot } from './runtime.types'
import { webRuntime } from './webRuntime'

type RuntimeContextValue = {
  ready: boolean
  snapshot: RuntimeSnapshot
}

const initialSnapshot: RuntimeSnapshot = {
  lifecycle: 'active',
  connected: typeof navigator === 'undefined' ? true : navigator.onLine,
  network: typeof navigator !== 'undefined' && !navigator.onLine ? 'none' : 'unknown',
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null)

type RuntimeProviderProps = PropsWithChildren<{ adapter?: RuntimeAdapter }>

export function RuntimeProvider({ adapter, children }: RuntimeProviderProps) {
  const runtimeAdapter = useMemo(() => {
    if (adapter) return adapter
    const target = resolveAppTarget(import.meta.env.VITE_APP_TARGET, Capacitor.isNativePlatform())
    return target === 'ios' ? capacitorRuntime : webRuntime
  }, [adapter])
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    let removeListener: (() => void) | undefined
    let receivedEvent = false

    const initialize = async () => {
      const unsubscribe = await runtimeAdapter.subscribe((next) => {
        receivedEvent = true
        if (mounted) setSnapshot(next)
      })
      if (!mounted) {
        unsubscribe()
        return
      }
      removeListener = unsubscribe

      const current = await runtimeAdapter.getSnapshot()
      if (!mounted) return
      if (!receivedEvent) setSnapshot(current)
      setReady(true)
    }

    void initialize()

    return () => {
      mounted = false
      removeListener?.()
    }
  }, [runtimeAdapter])

  return <RuntimeContext.Provider value={{ ready, snapshot }}>{children}</RuntimeContext.Provider>
}

export function useRuntime() {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error('useRuntime must be used within a RuntimeProvider')
  return value
}

export function useOptionalRuntime() {
  return useContext(RuntimeContext)
}
