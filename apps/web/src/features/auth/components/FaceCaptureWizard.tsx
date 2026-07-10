import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Space } from 'antd'
import { Camera, Check, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'
import { detectFacesForLogin } from '../utils/browserFaceDetection'
import './face-capture.css'

type CaptureState = 'idle' | 'starting' | 'ready' | 'capturing' | 'error'

type Props = {
  /** 采集帧数（多帧可提升录入/比对稳健性），默认 2 */
  frameCount?: number
  /** 帧间隔毫秒 */
  frameGapMs?: number
  /** 动作活体模式：提示用户转头并录制更长的多帧序列 */
  actionMode?: boolean
  /** 自动模式：打开即自动开摄像头，检测到人脸后自动采集（用于登录，少点几下） */
  auto?: boolean
  /** 父级是否正在提交（提交期间禁用按钮） */
  busy?: boolean
  /** 采集完成回调，返回若干帧 base64（不含 data: 前缀） */
  onComplete: (images: string[]) => void
}

// -1 表示前端检测不可用（降级为定时自动采集），0/1/2+ 为实时人脸数
type FaceGate = -1 | 0 | 1 | 2

const DETECT_INTERVAL_MS = 550
// 连续 N 次检测到单人脸才触发自动采集，避免路人经过时误拍
const STABLE_HITS_REQUIRED = 2

function sleep(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms))
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop())
}

async function waitForFrame(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0) return
  await new Promise<void>(resolve => {
    const onReady = () => {
      video.removeEventListener('loadeddata', onReady)
      resolve()
    }
    video.addEventListener('loadeddata', onReady)
  })
}

// 降采样到最长边 maxSize，显著加快服务端 CPU 人脸检测并缩小上传体积
function captureFrames(
  video: HTMLVideoElement,
  count: number,
  gapMs: number,
  onFrame?: (done: number) => void,
  maxSize = 640
): Promise<string[]> {
  const vw = video.videoWidth || 640
  const vh = video.videoHeight || 480
  const scale = Math.min(1, maxSize / Math.max(vw, vh))
  const w = Math.round(vw * scale)
  const h = Math.round(vh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve([])

  return (async () => {
    const frames: string[] = []
    for (let i = 0; i < count; i++) {
      ctx.drawImage(video, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      frames.push(dataUrl.split(',')[1] || dataUrl)
      onFrame?.(i + 1)
      if (i < count - 1) await sleep(gapMs)
    }
    return frames
  })()
}

export default function FaceCaptureWizard({
  frameCount = 2,
  frameGapMs = 350,
  actionMode = false,
  auto = false,
  busy = false,
  onComplete,
}: Props) {
  // 动作模式录制多帧（约 2.5s）以捕捉头部转动；8 帧兼顾引擎上限与 CPU 速度
  const effFrameCount = actionMode ? 8 : frameCount
  const effFrameGapMs = actionMode ? 320 : frameGapMs
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const autoFiredRef = useRef(false)
  const stableHitsRef = useRef(0)
  const detectBusyRef = useRef(false)
  const countdownTimerRef = useRef<number | null>(null)
  const [state, setState] = useState<CaptureState>('idle')
  const [error, setError] = useState<string>('')
  const [hasCaptured, setHasCaptured] = useState(false)
  const [countdown, setCountdown] = useState(0) // 动作模式开拍前的倒计时
  const [faceGate, setFaceGate] = useState<FaceGate>(-1)
  const [frameProgress, setFrameProgress] = useState(0)
  const [detectionReady, setDetectionReady] = useState(false)

  const start = useCallback(async () => {
    setError('')
    autoFiredRef.current = false
    stableHitsRef.current = 0
    setHasCaptured(false)
    setFrameProgress(0)
    setCountdown(0)
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError('当前浏览器无法访问摄像头，请更换浏览器或使用扫码方式')
      return
    }
    setState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => undefined)
      await waitForFrame(video)
      setState('ready')
    } catch (e: any) {
      stopStream(streamRef.current)
      streamRef.current = null
      setState('error')
      const name = String(e?.name || '')
      setError(/notallowed|permission/i.test(name) ? '摄像头权限被拒绝' : '摄像头不可用')
    }
  }, [])

  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setState('capturing')
    setFrameProgress(0)
    try {
      const frames = await captureFrames(video, effFrameCount, effFrameGapMs, done =>
        setFrameProgress(done / effFrameCount)
      )
      onComplete(frames)
      setHasCaptured(true)
      setState('ready')
    } catch {
      setState('error')
      setError('采集失败，请重试')
    }
  }, [effFrameCount, effFrameGapMs, onComplete])

  // 实时人脸检测（原生 FaceDetector → MediaPipe → tfjs 三级降级，全部离线）：
  // 驱动光环状态与提示，auto 模式下检测到稳定单人脸才自动开拍。
  useEffect(() => {
    if (state !== 'ready' || hasCaptured) return
    let alive = true
    const timer = window.setInterval(async () => {
      const video = videoRef.current
      if (!video || detectBusyRef.current) return
      detectBusyRef.current = true
      try {
        const result = await detectFacesForLogin(video)
        if (!alive) return
        setDetectionReady(true)
        const gate: FaceGate = result.faceCount === 0 ? 0 : result.faceCount === 1 ? 1 : 2
        setFaceGate(gate)
        stableHitsRef.current = gate === 1 ? stableHitsRef.current + 1 : 0
      } catch {
        if (!alive) return
        // 检测能力不可用：降级为"无门控"（定时自动采集），不影响主流程
        setFaceGate(-1)
        setDetectionReady(true)
        stableHitsRef.current = STABLE_HITS_REQUIRED
      } finally {
        detectBusyRef.current = false
      }
    }, DETECT_INTERVAL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [state, hasCaptured])

  // 自动模式：打开即开摄像头；检测到稳定单人脸（或检测不可用兜底 1.2s）后自动采集。
  // 动作模式先 3 秒倒计时提示转头。
  useEffect(() => {
    if (!auto) return
    if (state === 'idle') {
      start()
      return
    }
    if (state !== 'ready' || autoFiredRef.current || hasCaptured) return

    const fire = () => {
      if (autoFiredRef.current) return
      autoFiredRef.current = true
      if (actionMode) {
        let n = 3
        setCountdown(n)
        countdownTimerRef.current = window.setInterval(() => {
          n -= 1
          setCountdown(n)
          if (n <= 0) {
            if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
            capture()
          }
        }, 1000)
      } else {
        capture()
      }
    }

    // 检测尚未就绪时的兜底：3.5s 内检测器没跑起来就按旧逻辑定时开拍
    const fallback = window.setTimeout(() => {
      if (!detectionReady) fire()
    }, 3500)

    const gateTimer = window.setInterval(() => {
      if (stableHitsRef.current >= STABLE_HITS_REQUIRED) {
        window.clearInterval(gateTimer)
        fire()
      }
    }, 200)

    return () => {
      window.clearTimeout(fallback)
      window.clearInterval(gateTimer)
    }
  }, [auto, actionMode, state, hasCaptured, detectionReady, start, capture])

  // 卸载时释放摄像头与倒计时
  useEffect(() => {
    return () => {
      stopStream(streamRef.current)
      streamRef.current = null
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
    }
  }, [])

  const submitting = busy && hasCaptured
  const done = hasCaptured && !busy

  // 光环状态
  const stageClass = [
    'fcw-stage',
    state === 'error' && 'fcw-stage--error',
    done && 'fcw-stage--done',
    submitting && 'fcw-stage--busy',
    state === 'ready' && !hasCaptured && faceGate === 1 && 'fcw-stage--lock',
    state === 'ready' && !hasCaptured && (faceGate === 0 || faceGate === 2) && 'fcw-stage--seek',
  ]
    .filter(Boolean)
    .join(' ')

  // 提示文案
  let hint = ''
  let hintTone: 'ok' | 'warn' | '' = ''
  if (state === 'starting') hint = '正在启动摄像头…'
  else if (submitting) hint = '正在验证，请稍候…'
  else if (done) hint = '采集完成'
  else if (state === 'capturing') {
    hint = actionMode ? '正在采集，请缓慢向左、再向右转动头部' : '正在识别，请保持面部在圆框内'
  } else if (countdown > 0) {
    hint = `请准备：${countdown} 秒后开始，按提示缓慢左右转动头部`
  } else if (state === 'ready') {
    if (faceGate === 0) {
      hint = '未检测到人脸，请将面部对准圆框'
      hintTone = 'warn'
    } else if (faceGate === 2) {
      hint = '检测到多张人脸，请保持画面中只有本人'
      hintTone = 'warn'
    } else if (faceGate === 1) {
      hint = '已锁定人脸，保持不动…'
      hintTone = 'ok'
    } else {
      hint = '正在识别，请正对摄像头、保持光线充足…'
    }
  }

  // 采集进度环参数（viewBox 100）
  const R = 48
  const CIRC = 2 * Math.PI * R
  const showProgress = state === 'capturing' && frameProgress > 0
  const showArrows = actionMode && (state === 'capturing' || countdown > 0)

  return (
    <div className="fcw">
      <div className={stageClass}>
        <div className="fcw-glow" />
        <div className="fcw-halo" />
        <div className="fcw-viewport">
          <video ref={videoRef} muted autoPlay playsInline className="fcw-video" />
          <div className="fcw-overlay">
            {countdown > 0 && (
              <span key={countdown} className="fcw-countdown">
                {countdown}
              </span>
            )}
            {done && (
              <span className="fcw-check">
                <Check size={40} strokeWidth={3} />
              </span>
            )}
          </div>
          {showArrows && (
            <>
              <span className="fcw-arrow fcw-arrow--left">
                <ChevronLeft size={34} strokeWidth={2.5} />
              </span>
              <span className="fcw-arrow fcw-arrow--right">
                <ChevronRight size={34} strokeWidth={2.5} />
              </span>
            </>
          )}
        </div>
        {showProgress && (
          <svg className="fcw-progress" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={R}
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - frameProgress)}
            />
          </svg>
        )}
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : <div className={`fcw-hint ${hintTone ? `fcw-hint--${hintTone}` : ''}`}>{hint}</div>}

      <Space>
        {state === 'error' ? (
          <Button type="primary" icon={<RefreshCw size={16} />} onClick={start}>
            {translate('auto.359a14c05f')}</Button>
        ) : auto && !hasCaptured ? null : state === 'idle' || state === 'starting' ? (
          !auto && (
            <Button type="primary" icon={<Camera size={16} />} loading={state === 'starting'} onClick={start}>
              {translate('auto.48793c9f0e')}</Button>
          )
        ) : (
          <>
            <Button
              type="primary"
              icon={<Camera size={16} />}
              loading={state === 'capturing' || busy}
              disabled={state !== 'ready'}
              onClick={capture}
            >
              {hasCaptured ? translate('visible.afa96d7486') : actionMode ? translate('visible.b149faeb4c') : translate('visible.9c012060c7')}
            </Button>
            <Button icon={<RefreshCw size={16} />} disabled={busy} onClick={start}>
              {translate('auto.359a14c05f')}</Button>
          </>
        )}
      </Space>
    </div>
  )
}
