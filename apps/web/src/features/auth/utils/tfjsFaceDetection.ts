import { publicAsset } from './assetPath'

type FaceDetectionResult = {
  faceCount: number
  detector: Record<string, unknown>
}

// WebGL2 不可用时的降级人脸检测：TensorFlow.js + BlazeFace，运行在纯 CPU 的 WASM 后端，
// 完全不依赖 WebGL/GPU。模型与 tfjs wasm 二进制均已离线 vendoring 到 public/vendor 下，
// 与 MediaPipe 的离线策略保持一致（不走任何 CDN）。
// BlazeFace 与 MediaPipe 主路径用的是同源模型，检测行为一致；此处仅用于统计人脸数量。
let modelPromise: Promise<any> | null = null

async function getBlazefaceModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs-core')
      // 注册 GraphModel 加载器（BlazeFace 通过 loadGraphModel 加载）
      await import('@tensorflow/tfjs-converter')
      const { setWasmPaths } = await import('@tensorflow/tfjs-backend-wasm')
      // 指向离线 vendoring 的 wasm 目录（tfjs 会按浏览器能力自选 simd / 非 simd 变体）
      setWasmPaths(publicAsset('vendor/tfjs-wasm/'))
      await tf.setBackend('wasm')
      await tf.ready()
      const blazeface = await import('@tensorflow-models/blazeface')
      return blazeface.load({ modelUrl: publicAsset('vendor/blazeface/model.json') })
    })().catch(error => {
      modelPromise = null
      throw error
    })
  }
  return modelPromise
}

export async function detectFacesWithTfjs(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  const model = await getBlazefaceModel()
  const predictions = await model.estimateFaces(video, false)
  return {
    faceCount: Array.isArray(predictions) ? predictions.length : 0,
    detector: {
      api: 'TensorFlow.js BlazeFace',
      model: 'blazeface',
      backend: 'wasm',
    },
  }
}
