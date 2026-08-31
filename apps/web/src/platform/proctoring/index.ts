import { Capacitor } from '@capacitor/core'
import { resolveAppTarget } from '@/platform/appTarget'
import type { ProctoringAdapter } from './proctoring.types'
import { nativeProctoring } from './nativeProctoring'
import { webProctoring } from './webProctoring'

export function resolveProctoringAdapter(): ProctoringAdapter {
  const target = resolveAppTarget(import.meta.env.VITE_APP_TARGET, Capacitor.isNativePlatform())
  return target === 'ios' ? nativeProctoring : webProctoring
}

export type {
  NativeProctoringFact,
  NativeProctoringStatus,
  ProctoringAdapter,
  ProctoringPermission,
  ProctoringPermissionStatus,
} from './proctoring.types'
export { createNativeProctoringAdapter } from './nativeProctoring'
export { createWebProctoringAdapter } from './webProctoring'
