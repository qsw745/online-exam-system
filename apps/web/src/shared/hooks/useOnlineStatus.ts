import { useEffect, useState } from 'react'
import { useOptionalRuntime } from '@/platform/runtime/RuntimeProvider'

export function useOnlineStatus() {
  const runtime = useOptionalRuntime()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    if (runtime) return
    const markOnline = () => setOnline(true)
    const markOffline = () => setOnline(false)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [runtime])

  return runtime?.snapshot.connected ?? online
}

export default useOnlineStatus
