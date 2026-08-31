export type AppTarget = 'web' | 'ios'

export function resolveAppTarget(raw?: string, nativePlatform = false): AppTarget {
  if (String(raw || '').trim().toLowerCase() === 'ios') return 'ios'
  return nativePlatform ? 'ios' : 'web'
}
