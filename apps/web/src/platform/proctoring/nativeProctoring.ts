import { registerPlugin } from '@capacitor/core'
import type {
  NativeProctoringFact,
  NativeProctoringStatus,
  ProctoringAdapter,
  ProctoringPermissionStatus,
} from './proctoring.types'

type ListenerHandle = { remove(): Promise<void> }

export type WenhengProctoringPlugin = {
  permissionStatus(): Promise<ProctoringPermissionStatus>
  requestSensorPermissions(): Promise<ProctoringPermissionStatus>
  start(): Promise<NativeProctoringStatus>
  status(): Promise<NativeProctoringStatus>
  captureIdentityFrames(): Promise<{ images: string[] }>
  stop(): Promise<void>
  openSettings(): Promise<void>
  addListener(eventName: 'proctoringFact', listener: (fact: NativeProctoringFact) => void): Promise<ListenerHandle>
}

export const WenhengProctoring = registerPlugin<WenhengProctoringPlugin>('WenhengProctoring')

export function createNativeProctoringAdapter(
  plugin: WenhengProctoringPlugin = WenhengProctoring,
): ProctoringAdapter {
  return {
    kind: 'native',
    permissionStatus: () => plugin.permissionStatus(),
    requestPermissions: () => plugin.requestSensorPermissions(),
    start: () => plugin.start(),
    status: () => plugin.status(),
    async captureIdentityFrames() {
      const result = await plugin.captureIdentityFrames()
      return Array.isArray(result.images) ? result.images.slice(0, 3) : []
    },
    stop: () => plugin.stop(),
    openSettings: () => plugin.openSettings(),
    async addFactListener(listener) {
      const handle = await plugin.addListener('proctoringFact', listener)
      return () => handle.remove()
    },
  }
}

export const nativeProctoring = createNativeProctoringAdapter()
