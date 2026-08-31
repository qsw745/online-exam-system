import { detectFacesForLogin } from '@/features/auth/utils/browserFaceDetection'
import type {
  NativeProctoringFact,
  NativeProctoringStatus,
  ProctoringAdapter,
  ProctoringPermission,
  ProctoringPermissionStatus,
} from './proctoring.types'

const permissionName = (state?: PermissionState): ProctoringPermission => {
  if (state === 'granted') return 'granted'
  if (state === 'denied') return 'denied'
  return 'prompt'
}

export function createWebProctoringAdapter(): ProctoringAdapter {
  let stream: MediaStream | null = null
  let video: HTMLVideoElement | null = null
  let faceCount: 0 | 1 | 2 = 0
  let light: 'normal' | 'dark' = 'normal'
  let interval: number | undefined
  const listeners = new Set<(fact: NativeProctoringFact) => void>()

  const status = async (): Promise<NativeProctoringStatus> => {
    const videoTrack = stream?.getVideoTracks()[0]
    const audioTrack = stream?.getAudioTracks()[0]
    return {
      running: Boolean(videoTrack?.readyState === 'live' && audioTrack?.readyState === 'live'),
      camera: !videoTrack ? 'unavailable' : videoTrack.readyState === 'live' ? 'available' : 'interrupted',
      microphone: !audioTrack ? 'unavailable' : audioTrack.readyState === 'live' ? 'available' : 'interrupted',
      app: document.visibilityState === 'visible' ? 'foreground' : 'background',
      faceCount,
      light,
      screenCaptured: false,
      storesAudio: false,
      uploadsContinuousMedia: false,
    }
  }

  const emit = async (type: string) => {
    const fact = { type, occurredAt: new Date().toISOString(), state: await status() }
    listeners.forEach(listener => listener(fact))
  }

  const ensureStream = async () => {
    if (stream?.getTracks().every(track => track.readyState === 'live')) return stream
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('PROCTORING_MEDIA_UNAVAILABLE')
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    })
    stream.getVideoTracks()[0]?.addEventListener('ended', () => void emit('camera_interrupted'))
    stream.getAudioTracks()[0]?.addEventListener('ended', () => void emit('microphone_interrupted'))
    return stream
  }

  const queryPermission = async (name: 'camera' | 'microphone') => {
    try {
      const result = await navigator.permissions?.query({ name: name as PermissionName })
      return permissionName(result?.state)
    } catch {
      return 'prompt' as const
    }
  }

  const permissionStatus = async (): Promise<ProctoringPermissionStatus> => ({
    camera: await queryPermission('camera'),
    microphone: await queryPermission('microphone'),
  })

  const handleVisibility = () => void emit(document.hidden ? 'app_backgrounded' : 'app_foregrounded')
  const handleOffline = () => void emit('network_lost')
  const handleOnline = () => void emit('network_restored')

  return {
    kind: 'web',
    permissionStatus,
    async requestPermissions() {
      try {
        await ensureStream()
      } catch {
        return permissionStatus()
      }
      return permissionStatus()
    },
    async start() {
      const active = await ensureStream()
      video ??= document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = active
      await video.play()
      document.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('offline', handleOffline)
      window.addEventListener('online', handleOnline)
      if (!interval) {
        interval = window.setInterval(async () => {
          if (!video || video.readyState < 2) return
          try {
            const previous = faceCount
            const result = await detectFacesForLogin(video)
            faceCount = Math.min(2, Math.max(0, result.faceCount)) as 0 | 1 | 2
            if (previous !== faceCount) {
              if (faceCount === 0) void emit('face_missing')
              if (faceCount === 2) void emit('multiple_faces')
            }
          } catch {
            // 检测器不可用不等于考生违规，传感器状态仍由服务端心跳判断。
          }
        }, 3000)
      }
      return status()
    },
    status,
    async captureIdentityFrames() {
      if (!video || video.readyState < 2) return []
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(640, video.videoWidth || 640)
      canvas.height = Math.min(480, video.videoHeight || 480)
      const context = canvas.getContext('2d')
      if (!context) return []
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      return [canvas.toDataURL('image/jpeg', 0.72)]
    },
    async stop() {
      if (interval) window.clearInterval(interval)
      interval = undefined
      stream?.getTracks().forEach(track => track.stop())
      stream = null
      if (video) video.srcObject = null
      video = null
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      faceCount = 0
      light = 'normal'
    },
    async openSettings() {
      throw new Error('PROCTORING_SETTINGS_MANUAL')
    },
    async addFactListener(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const webProctoring = createWebProctoringAdapter()
