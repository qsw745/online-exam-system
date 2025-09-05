// apps/backend/src/common/middleware/upload.ts
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import type { RequestHandler } from 'express'

/**
 * 统一的上传根目录：
 * 1) 优先使用环境变量 UPLOADS_DIR
 * 2) 否则回落到 <进程工作目录>/uploads
 *    —— 与 app.ts 的逻辑一致，避免 404
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => cb(null, makeAvatarFilename(file.originalname)),
})

const uploadAny = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).any()

/**
 * 兼容字段名：
 * - 常见：avatar
 * - 也接受：file
 * - 最后兜底取第一个文件
 */
export const avatarUpload: RequestHandler = (req, res, next) => {
  uploadAny(req, res, (err: any) => {
    if (err) return next(err)

    const anyFiles = (req as any).files
    if (!(req as any).file) {
      let picked: Express.Multer.File | undefined
      if (Array.isArray(anyFiles)) {
        picked = anyFiles[0]
      } else if (anyFiles && typeof anyFiles === 'object') {
        picked =
          anyFiles['avatar']?.[0] ||
          anyFiles['file']?.[0] ||
          (Object.values<any>(anyFiles)[0]?.[0] as Express.Multer.File | undefined)
      }
      if (picked) (req as any).file = picked
    }

    next()
  })
}
