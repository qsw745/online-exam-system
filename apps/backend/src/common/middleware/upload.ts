// apps/backend/src/common/middleware/upload.ts
import multer from 'multer'
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

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => cb(null, makeAvatarFilename(file.originalname)),
})

/**
 * ✅ 导出的是 multer 实例（不是 RequestHandler）
 * 这样路由里可以调用 upload.single('avatar')
 */
export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('仅支持图片文件'))
        }
        cb(null, true)
    },
})
