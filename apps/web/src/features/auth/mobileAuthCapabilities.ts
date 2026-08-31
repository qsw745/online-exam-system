import type { AppTarget } from '@/platform/appTarget'

export type AuthCapabilities = {
  oauth: boolean
  faceLogin: boolean
  qrLogin: boolean
}

export function resolveAuthCapabilities(target: AppTarget): AuthCapabilities {
  const enabled = target === 'web'
  return {
    oauth: enabled,
    faceLogin: enabled,
    qrLogin: enabled,
  }
}
