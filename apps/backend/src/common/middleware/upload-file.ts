// apps/backend/src/common/middleware/upload-file.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import multer from 'multer'
import type { Request } from 'express'

declare const require: any
declare const process: any

const path: any = (() => {
  try {
    return require('node:path')
  } catch {
    return require('path')
  }
})()

const fs: any = (() => {
  try {
    return require('node:fs')
  } catch {
    return require('fs')
  }
})()

const ROOT =
  (process?.env?.UPLOADS_DIR as string) ||
  path.resolve(process?.cwd?.() || (typeof process.cwd === 'function' ? process.cwd() : '.'), 'uploads')
const FILES_DIR = path.join(ROOT, 'files')

try {
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })
} catch {}

type UploadedFile = { originalname: string; mimetype: string }

const storage = multer.diskStorage({
  destination: (_req: Request, _file: UploadedFile, cb: (error: any, destination: string) => void) => {
    cb(null, FILES_DIR)
  },
  filename: (_req: Request, file: UploadedFile, cb: (error: any, filename: string) => void) => {
    const ext = path.extname(file.originalname || '') || ''
    const base = (file.originalname || '').replace(ext, '')
    const safeBase = base.replace(/[^\w.-]+/g, '-').slice(0, 80) || 'file'
    const rnd = Math.random().toString(16).slice(2, 8)
    const timestamp = Date.now()
    cb(null, `${safeBase}-${timestamp}-${rnd}${ext}`)
  },
})

export const fileUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
})

export type FileUploadMiddleware = typeof fileUpload
