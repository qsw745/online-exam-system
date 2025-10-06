import multer from 'multer'
import type { Request } from 'express'
import path from 'node:path'
import fs from 'node:fs'

/**
 * uploads 根目录与 app.ts 一致
 */
const UPLOAD_ROOT = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars')

// 确保目录存在
for (const dir of [UPLOAD_ROOT, AVATAR_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/** 自定义文件名：avatar-时间戳-随机.扩展名 */
function makeAvatarFilename(original: string) {
  const ext = path.extname(original) || '.jpg'
  const rnd = Math.random().toString().slice(2)
  return `avatar-${Date.now()}-${rnd}${ext}`
}

/** 本地最小文件类型定义，避免依赖全局 Express.Multer 命名空间 */
type UploadedFile = { originalname: string; mimetype: string }
/** 兼容不同版本的 multer 类型导出 */
type FileFilterCb = (error: Error | null, acceptFile: boolean) => void

const storage = multer.diskStorage({
  destination: (_req: Request, _file: UploadedFile, cb: (error: any, destination: string) => void) =>
    cb(null, AVATAR_DIR),
  filename: (_req: Request, file: UploadedFile, cb: (error: any, filename: string) => void) =>
    cb(null, makeAvatarFilename(file.originalname)),
})

/**
 * ✅ 导出的是 multer 实例（不是 RequestHandler）
 * 这样路由里可以调用 upload.single('avatar')
 */
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: Request, file: UploadedFile, cb: FileFilterCb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('仅支持图片文件'), false)
    }
    cb(null, true)
  },
})
