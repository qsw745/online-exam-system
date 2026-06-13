import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { proctoringApi, type ProctoringSeverity } from '@/shared/api/endpoints/proctoring'

export type ProctoringConfig = {
  enabled: boolean
  level: 'off' | 'basic' | 'strict'
  requireCamera: boolean
  requireMic: boolean
  intervalMs: number
}

type ProctoringStatus = {
  enabled: boolean
  camera: 'init' | 'ok' | 'off' | 'denied' | 'error'
  mic: 'init' | 'ok' | 'off' | 'denied' | 'error'
  face: 'unknown' | 'ok' | 'missing' | 'multiple'
  light: 'unknown' | 'ok' | 'dark'
  audio: 'unknown' | 'quiet' | 'noisy'
  warnings: number
  lastEvent?: { type: string; severity: ProctoringSeverity; message: string; at: string }
}

type ReportEventInput = {
  type: string
  severity?: ProctoringSeverity
  message?: string
  meta?: any
}

const DEFAULT_STATUS: ProctoringStatus = {
  enabled: false,
  camera: 'init',
  mic: 'init',
  face: 'unknown',
  light: 'unknown',
  audio: 'unknown',
  warnings: 0,
}

const shallowPatch = (prev: ProctoringStatus, patch: Partial<ProctoringStatus>) => {
  for (const key of Object.keys(patch) as Array<keyof ProctoringStatus>) {
    if (prev[key] !== patch[key]) return { ...prev, ...patch }
  }
  return prev
}

export function useAiProctoring(opts: { examId?: number; taskId?: number; config?: ProctoringConfig }) {
  const { examId, taskId, config } = opts
  const enabled = Boolean(config?.enabled && examId)
  const intervalMs = config?.intervalMs || (config?.level === 'strict' ? 2500 : 4000)
  const cooldownMs = config?.level === 'strict' ? 8000 : 15000

  const [status, setStatus] = useState<ProctoringStatus>(() => ({ ...DEFAULT_STATUS, enabled }))
  const [restartKey, setRestartKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const cooldownRef = useRef<Record<string, number>>({})
  const faceDetectorRef = useRef<any | null | undefined>(undefined)
  const checkLockRef = useRef(false)
  const missingFaceRef = useRef(0)
  const multiFaceRef = useRef(0)
  const darkRef = useRef(0)
  const noisyRef = useRef(0)

  useEffect(() => {
    setStatus(prev => shallowPatch(prev, { enabled }))
  }, [enabled])

  const reportEvent = useCallback(
    (event: ReportEventInput) => {
      if (!enabled || !examId) return
      const type = String(event.type || '').trim()
      if (!type) return
      const now = Date.now()
      const last = cooldownRef.current[type] || 0
      if (now - last < cooldownMs) return
      cooldownRef.current[type] = now
      const severity: ProctoringSeverity = event.severity || 'warn'
      const message = event.message || ''
      const at = new Date().toISOString()
      setStatus(prev => ({
        ...prev,
        warnings: prev.warnings + (severity === 'info' ? 0 : 1),
        lastEvent: { type, severity, message, at },
      }))
      void proctoringApi.reportEvent({
        examId,
        taskId,
        type,
        severity,
        message,
        meta: event.meta,
        occurredAt: at,
        source: 'browser',
      })
    },
    [cooldownMs, enabled, examId, taskId]
  )

  const restart = useCallback(() => setRestartKey(k => k + 1), [])

  const ensureDetector = useCallback(() => {
    if (faceDetectorRef.current !== undefined) return faceDetectorRef.current
    const ctor = (window as any).FaceDetector
    faceDetectorRef.current = ctor ? new ctor({ fastMode: true, maxDetectedFaces: 3 }) : null
    return faceDetectorRef.current
  }, [])

  const initAnalyser = useCallback((stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0]
    if (!audioTrack) return
    if (!audioCtxRef.current) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctor) return
      audioCtxRef.current = new Ctor()
    }
    const ctx = audioCtxRef.current
    if (!ctx) return
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyserRef.current = analyser
  }, [])

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    analyserRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !examId) {
      stopMedia()
      return
    }

    let alive = true
    let timer: number | undefined
    let canvas: HTMLCanvasElement | null = null
    let ctx: CanvasRenderingContext2D | null = null

    const setPatch = (patch: Partial<ProctoringStatus>) => {
      setStatus(prev => shallowPatch(prev, patch))
    }

    const attachStream = (stream: MediaStream) => {
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        video.play().catch(() => {})
      }
    }

    const pickStream = async (video: boolean, audio: boolean) => {
      if (!navigator.mediaDevices?.getUserMedia) return null
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio })
        return { stream, videoOk: video, audioOk: audio }
      } catch {
        if (!video || !audio) return null
      }

      const [vs, as] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null),
        navigator.mediaDevices.getUserMedia({ video: false, audio: true }).catch(() => null),
      ])
      if (!vs && !as) return null
      const tracks = [...(vs?.getVideoTracks() || []), ...(as?.getAudioTracks() || [])]
      return { stream: new MediaStream(tracks), videoOk: Boolean(vs), audioOk: Boolean(as) }
    }

    const start = async () => {
      missingFaceRef.current = 0
      multiFaceRef.current = 0
      darkRef.current = 0
      noisyRef.current = 0
      cooldownRef.current = {}
      const wantVideo = Boolean(config?.requireCamera)
      const wantAudio = Boolean(config?.requireMic)
      setPatch({
        camera: wantVideo ? 'init' : 'off',
        mic: wantAudio ? 'init' : 'off',
        face: 'unknown',
        light: 'unknown',
        audio: 'unknown',
      })

      const result = await pickStream(wantVideo, wantAudio)
      if (!alive) return
      if (!result?.stream) {
        if (wantVideo) reportEvent({ type: 'camera_denied', severity: 'critical' })
        if (wantAudio) reportEvent({ type: 'mic_denied', severity: 'critical' })
        setPatch({
          camera: wantVideo ? 'denied' : 'off',
          mic: wantAudio ? 'denied' : 'off',
        })
        return
      }

      attachStream(result.stream)
      const videoTrack = result.stream.getVideoTracks()[0]
      const audioTrack = result.stream.getAudioTracks()[0]
      setPatch({
        camera: videoTrack ? 'ok' : wantVideo ? 'denied' : 'off',
        mic: audioTrack ? 'ok' : wantAudio ? 'denied' : 'off',
      })
      if (wantVideo && !videoTrack) reportEvent({ type: 'camera_denied', severity: 'critical' })
      if (wantAudio && !audioTrack) reportEvent({ type: 'mic_denied', severity: 'critical' })

      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          setPatch({ camera: 'off' })
          reportEvent({ type: 'camera_lost', severity: 'critical' })
        })
      }
      if (audioTrack) {
        audioTrack.addEventListener('ended', () => {
          setPatch({ mic: 'off' })
          reportEvent({ type: 'mic_lost', severity: 'critical' })
        })
      }

      initAnalyser(result.stream)

      canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 120
      ctx = canvas.getContext('2d', { willReadFrequently: true })

      const detector = ensureDetector()

      const tick = async () => {
        if (!alive || checkLockRef.current) return
        checkLockRef.current = true

        try {
          const video = videoRef.current
          if (video && ctx && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas!.width, canvas!.height)
            const pixels = ctx.getImageData(0, 0, canvas!.width, canvas!.height).data
            let sum = 0
            let count = 0
            for (let i = 0; i < pixels.length; i += 16) {
              sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
              count += 1
            }
            const avg = count ? sum / count : 0
            if (avg < 40) {
              darkRef.current += 1
              if (darkRef.current >= 2) {
                setPatch({ light: 'dark' })
                reportEvent({ type: 'camera_dark', severity: 'warn', meta: { avg } })
              }
            } else {
              darkRef.current = 0
              setPatch({ light: 'ok' })
            }

            if (detector) {
              const faces = await detector.detect(canvas)
              const countFaces = Array.isArray(faces) ? faces.length : 0
              if (countFaces === 0) {
                missingFaceRef.current += 1
                multiFaceRef.current = 0
                if (missingFaceRef.current >= 2) {
                  setPatch({ face: 'missing' })
                  reportEvent({ type: 'camera_no_face', severity: 'warn' })
                }
              } else if (countFaces > 1) {
                multiFaceRef.current += 1
                missingFaceRef.current = 0
                if (multiFaceRef.current >= 2) {
                  setPatch({ face: 'multiple' })
                  reportEvent({ type: 'camera_multi_face', severity: 'critical', meta: { count: countFaces } })
                }
              } else {
                missingFaceRef.current = 0
                multiFaceRef.current = 0
                setPatch({ face: 'ok' })
              }
            }
          }

          if (analyserRef.current) {
            const analyser = analyserRef.current
            const data = new Uint8Array(analyser.fftSize)
            analyser.getByteTimeDomainData(data)
            let sum = 0
            for (const v of data) {
              const delta = v - 128
              sum += delta * delta
            }
            const rms = Math.sqrt(sum / data.length) / 128
            if (rms > 0.12) {
              noisyRef.current += 1
              setPatch({ audio: 'noisy' })
              if (noisyRef.current >= 3) {
                reportEvent({ type: 'audio_detected', severity: 'warn', meta: { rms } })
                noisyRef.current = 0
              }
            } else {
              noisyRef.current = 0
              setPatch({ audio: 'quiet' })
            }
          }
        } finally {
          checkLockRef.current = false
        }
      }

      timer = window.setInterval(() => {
        void tick()
      }, intervalMs)
    }

    void start()

    return () => {
      alive = false
      if (timer) window.clearInterval(timer)
      stopMedia()
    }
  }, [
    config?.requireCamera,
    config?.requireMic,
    enabled,
    ensureDetector,
    examId,
    initAnalyser,
    intervalMs,
    reportEvent,
    restartKey,
    stopMedia,
  ])

  return useMemo(() => ({ status, videoRef, reportEvent, restart }), [reportEvent, restart, status])
}
