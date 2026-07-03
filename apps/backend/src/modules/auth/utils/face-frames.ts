// 人脸采集帧的统一校验：帧数上限 + 单帧 base64 长度上限（防超大 payload 滥用）。
const MAX_FRAMES = 16
const MAX_FRAME_CHARS = 2_000_000 // 单帧 base64 上限（约 1.5MB 原始字节）

export function validateFaceFrames(images: unknown): string[] | null {
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_FRAMES) return null
  for (const item of images) {
    if (typeof item !== 'string' || item.length === 0 || item.length > MAX_FRAME_CHARS) return null
  }
  return images as string[]
}
