import { Capacitor } from '@capacitor/core'

import { resolveAppTarget } from '@/platform/appTarget'

import type { ExamVaultAdapter } from './examVault.types'
import { nativeExamVault } from './nativeExamVault'
import { createWebExamVault } from './webExamVault'

export function resolveExamVaultAdapter(): ExamVaultAdapter | null {
  const target = resolveAppTarget(import.meta.env.VITE_APP_TARGET, Capacitor.isNativePlatform())
  if (target === 'ios') return nativeExamVault
  if (typeof window === 'undefined') return null
  try {
    return createWebExamVault(window.localStorage)
  } catch {
    return null
  }
}

export type { ExamVaultAdapter } from './examVault.types'
export { createNativeExamVaultAdapter } from './nativeExamVault'
export { createWebExamVault } from './webExamVault'
