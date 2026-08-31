import type { AppLifecycleState, RuntimeAdapter, RuntimeSnapshot } from './runtime.types'

function browserLifecycle(): AppLifecycleState {
  if (typeof document === 'undefined') return 'active'
  if (document.visibilityState === 'hidden') return 'background'
  return typeof document.hasFocus === 'function' && !document.hasFocus() ? 'inactive' : 'active'
}

function browserSnapshot(): RuntimeSnapshot {
  const connected = typeof navigator === 'undefined' ? true : navigator.onLine
  return {
    lifecycle: browserLifecycle(),
    connected,
    network: connected ? 'unknown' : 'none',
  }
}

export const webRuntime: RuntimeAdapter = {
  async getSnapshot() {
    return browserSnapshot()
  },

  async subscribe(listener) {
    const publish = () => listener(browserSnapshot())
    window.addEventListener('online', publish)
    window.addEventListener('offline', publish)
    window.addEventListener('focus', publish)
    window.addEventListener('blur', publish)
    document.addEventListener('visibilitychange', publish)

    return () => {
      window.removeEventListener('online', publish)
      window.removeEventListener('offline', publish)
      window.removeEventListener('focus', publish)
      window.removeEventListener('blur', publish)
      document.removeEventListener('visibilitychange', publish)
    }
  },
}
