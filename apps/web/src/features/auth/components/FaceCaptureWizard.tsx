import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Space } from 'antd'
import { Camera, RefreshCw } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'

type CaptureState = 'idle' | 'starting' | 'ready' | 'capturing' | 'error'

type Props = {
  /** 采集帧数（多帧可提升录入/比对稳健性），默认 2 */
  frameCount?: number
  /** 帧间隔毫秒 */
  frameGapMs?: number
  /** 动作活体模式：提示用户转头并录制更长的多帧序列 */
  actionMode?: boolean
  /** 自动模式：打开即自动开摄像头并自动采集一次（用于登录，少点几下）。actionMode 下不自动采集。 */
  auto?: boolean
  /** 父级是否正在提交（提交期间禁用按钮） */
  busy?: boolean
  /** 采集完成回调，返回若干帧 base64（不含 data: 前缀） */
  onComplete: (images: string[]) => void
}

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
  const [state, setState] = useState<CaptureState>('idle')
  const [error, setError] = useState<string>('')
  const [hasCaptured, setHasCaptured] = useState(false)
  const [countdown, setCountdown] = useState(0) // 动作模式开拍前的倒计时

  const start = useCallback(async () => {
    setError('')
    autoFiredRef.current = false
    setHasCaptured(false)
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
    try {
      const frames = await captureFrames(video, effFrameCount, effFrameGapMs)
      onComplete(frames)
      setHasCaptured(true)
      setState('ready')
    } catch {
      setState('error')
      setError('采集失败，请重试')
    }
  }, [effFrameCount, effFrameGapMs, onComplete])

  // 自动模式：打开即开摄像头；就绪后自动采集。动作模式先 3 秒倒计时提示转头。
  useEffect(() => {
    if (!auto) return
    if (state === 'idle') {
      start()
      return
    }
    if (state === 'ready' && !autoFiredRef.current) {
      autoFiredRef.current = true
      if (actionMode) {
        let n = 3
        setCountdown(n)
        const timer = window.setInterval(() => {
          n -= 1
          setCountdown(n)
          if (n <= 0) {
            window.clearInterval(timer)
            capture()
          }
        }, 1000)
        return () => window.clearInterval(timer)
      }
      const t = window.setTimeout(() => capture(), 1200)
      return () => window.clearTimeout(t)
    }
  }, [auto, actionMode, state, start, capture])

  // 卸载时释放摄像头
  useEffect(() => {
    return () => {
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  // 自动流程进行中：隐藏按钮，只显示提示
  const autoBusy = auto && !hasCaptured && state !== 'error'
  const autoHint = actionMode
    ? countdown > 0
      ? `请准备：${countdown} 秒后开始，按提示缓慢左右转动头部`
      : '正在采集，请缓慢向左、再向右转动头部…'
    : '正在识别，请正对摄像头、保持光线充足…'

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 360,
          aspectRatio: '4 / 3',
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      {autoBusy ? (
        <Alert type="info" showIcon message={autoHint} />
      ) : state === 'ready' || state === 'capturing' ? (
        <Alert
          type="info"
          showIcon
          message={
            actionMode
              ? state === 'capturing'
                ? translate('visible.60650b1fcf')
                : translate('visible.0659347bd0')
              : translate('visible.3cb702506f')
          }
        />
      ) : null}

      <Space>
        {state === 'error' ? (
          <Button type="primary" icon={<RefreshCw size={16} />} onClick={start}>
            {translate('auto.359a14c05f')}</Button>
        ) : autoBusy ? null : state === 'idle' || state === 'starting' ? (
          <Button type="primary" icon={<Camera size={16} />} loading={state === 'starting'} onClick={start}>
            {translate('auto.48793c9f0e')}</Button>
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
    </Space>
  )
}
