export type ProctoringPermission = 'granted' | 'denied' | 'restricted' | 'prompt' | 'unavailable'

export type ProctoringPermissionStatus = {
  camera: ProctoringPermission
  microphone: ProctoringPermission
}

export type NativeProctoringStatus = {
  running: boolean
  camera: 'available' | 'interrupted' | 'denied' | 'unavailable'
  microphone: 'available' | 'interrupted' | 'denied' | 'unavailable'
  app: 'foreground' | 'background'
  faceCount: 0 | 1 | 2
  light: 'normal' | 'dark'
  screenCaptured: boolean
  storesAudio: false
  uploadsContinuousMedia: false
}

export type NativeProctoringFact = {
  type: string
  occurredAt: string
  state: NativeProctoringStatus
}

export interface ProctoringAdapter {
  readonly kind: 'native' | 'web'
  permissionStatus(): Promise<ProctoringPermissionStatus>
  requestPermissions(): Promise<ProctoringPermissionStatus>
  start(): Promise<NativeProctoringStatus>
  status(): Promise<NativeProctoringStatus>
  captureIdentityFrames(): Promise<string[]>
  stop(): Promise<void>
  openSettings(): Promise<void>
  addFactListener(listener: (fact: NativeProctoringFact) => void): Promise<() => void>
}
