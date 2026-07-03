import { publicAsset } from './assetPath'
import { detectFacesWithTfjs } from './tfjsFaceDetection'

type FaceDetectionResult = {
  faceCount: number
  detector: Record<string, unknown>
}

let mediapipeDetectorPromise: Promise<any> | null = null

// MediaPipe tasks-vision 在做图像预处理时强依赖 WebGL2（即使 delegate 为 'CPU'）。
// 默认它会内部创建一个 OffscreenCanvas 并在其上获取 webgl2 上下文；在关闭硬件加速、
// 或 OffscreenCanvas 拿不到 webgl2 的环境下，内部 GL 上下文会变成 undefined，运行时
// 报 "Cannot read properties of undefined (reading 'activeTexture')"。
// 这里改为先用真实 <canvas> 显式探测并获取 webgl2 上下文，再把同一 canvas 交给 MediaPipe：
//   1) 真实 canvas 仍可回退软件渲染（SwiftShader），覆盖 OffscreenCanvas 失败的场景；
//   2) 浏览器确实不支持 WebGL2 时抛出可识别错误，便于给出准确提示而非误导性的“加载失败”。
function createWebgl2Canvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // 允许在无 GPU/软件渲染环境下创建上下文，避免直接返回 null
    failIfMajorPerformanceCaveat: false,
  })
  if (!gl) {
    throw new Error('WEBGL2_UNAVAILABLE')
  }
  return canvas
}

async function detectWithNative(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  const Detector = (window as any).FaceDetector
  if (!Detector) throw new Error('NATIVE_FACE_DETECTOR_UNAVAILABLE')
  const detector = new Detector({ fastMode: true, maxDetectedFaces: 3 })
  const faces = await detector.detect(video)
  return {
    faceCount: Array.isArray(faces) ? faces.length : 0,
    detector: { api: 'FaceDetector' },
  }
}

async function getMediapipeDetector() {
  if (!mediapipeDetectorPromise) {
    mediapipeDetectorPromise = (async () => {
      // 先探测 WebGL2，缺失时立即抛出可识别错误（避免后续 activeTexture 崩溃）
      const canvas = createWebgl2Canvas()
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(publicAsset('vendor/mediapipe/tasks-vision/wasm'))
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: publicAsset(
            'vendor/mediapipe/tasks-vision/models/blaze_face_short_range.tflite'
          ),
          delegate: 'CPU',
        },
        // 显式提供已验证的 WebGL2 画布，绕开默认 OffscreenCanvas 路径
        canvas,
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      })
    })().catch(error => {
      mediapipeDetectorPromise = null
      throw error
    })
  }
  return mediapipeDetectorPromise
}

async function detectWithMediapipe(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  const detector = await getMediapipeDetector()
  const result =
    typeof detector.detectForVideo === 'function'
      ? detector.detectForVideo(video, performance.now())
      : detector.detect(video)
  const detections = Array.isArray(result?.detections) ? result.detections : []
  return {
    faceCount: detections.length,
    detector: {
      api: 'MediaPipe FaceDetector',
      model: 'blaze_face_short_range',
    },
  }
}

// MediaPipe 因 WebGL2 缺失 / GL 上下文失败而无法工作时的识别条件，用于决定是否降级到 tfjs。
function isWebglRelatedFailure(error: unknown): boolean {
  const message = String((error as any)?.message || '')
  return /WEBGL2_UNAVAILABLE|activeTexture|getShaderInfoLog|createTexture|WebGL|getContext|OpenGL/i.test(
    message
  )
}

export async function detectFacesForLogin(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  // 1) 原生 Shape Detection API（不依赖 WebGL，优先尝试）
  if ((window as any).FaceDetector) {
    try {
      return await detectWithNative(video)
    } catch {}
  }
  // 2) MediaPipe（需要 WebGL2）。WebGL2 缺失会在创建检测器时抛出 WEBGL2_UNAVAILABLE，
  //    此时（或运行期 GL 失败时）降级到纯 CPU 的 tfjs BlazeFace，覆盖关闭硬件加速等环境。
  try {
    return await detectWithMediapipe(video)
  } catch (error) {
    if (isWebglRelatedFailure(error)) {
      return await detectFacesWithTfjs(video)
    }
    throw error
  }
}
