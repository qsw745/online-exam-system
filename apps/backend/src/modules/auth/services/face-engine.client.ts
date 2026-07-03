// Node → 人脸引擎（FastAPI）的调用适配器。把引擎当作可替换的下游，
// 以后换云 API 只改这一个文件。
import {
  FACE_ENGINE_URL,
  FACE_ENGINE_SHARED_SECRET,
  FACE_ENGINE_TIMEOUT_MS,
} from '@/config/face-engine'

export type FaceLiveness = { score: number; is_real: boolean }

export type FaceMotion = { yaw_range: number; pitch_range: number }

export type FaceAnalyzeAggregate = {
  all_single_face: boolean
  embedding: number[] | null
  liveness: FaceLiveness | null
  motion: FaceMotion | null
}

export type FaceFrameResult = {
  index: number
  face_count: number
  liveness: FaceLiveness | null
  error: string | null
}

export type FaceAnalyzeResult = {
  model: string
  dim: number
  frames: FaceFrameResult[]
  aggregate: FaceAnalyzeAggregate
}

type HttpError = Error & { status?: number }

function httpError(message: string, status: number): HttpError {
  return Object.assign(new Error(message), { status })
}

export async function analyzeFaces(
  images: string[],
  opts?: { needLiveness?: boolean }
): Promise<FaceAnalyzeResult> {
  if (!FACE_ENGINE_SHARED_SECRET) {
    throw httpError('人脸引擎未配置（缺少 FACE_ENGINE_SHARED_SECRET）', 503)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FACE_ENGINE_TIMEOUT_MS)
  try {
    const resp = await fetch(`${FACE_ENGINE_URL}/v1/face/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Engine-Secret': FACE_ENGINE_SHARED_SECRET,
      },
      body: JSON.stringify({
        images,
        need_embedding: true,
        need_liveness: opts?.needLiveness ?? true,
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw httpError(`人脸引擎返回 ${resp.status}：${text.slice(0, 160)}`, 502)
    }
    return (await resp.json()) as FaceAnalyzeResult
  } catch (error: unknown) {
    if ((error as Error)?.name === 'AbortError') {
      throw httpError('人脸引擎响应超时，请重试', 504)
    }
    if ((error as HttpError)?.status) throw error as HttpError
    throw httpError('无法连接人脸引擎服务', 502)
  } finally {
    clearTimeout(timer)
  }
}
