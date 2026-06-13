import { promises as fs } from 'fs'
import path from 'path'
import { ConfigRepository } from '@/modules/configs/repositories/config.repository'
import { NotificationAttachmentRepository } from '../repositories/notification-attachment.repository'

const UPLOAD_ROOT = (process.env.UPLOADS_DIR as string) || path.resolve(process.cwd(), 'uploads')
const CHUNK_DIR = path.join(UPLOAD_ROOT, 'notification-temp')
const DEST_DIR = path.join(UPLOAD_ROOT, 'notification-attachments')

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

type Settings = { maxSizeBytes: number; allowedExts: string[] }
async function loadSettings(): Promise<Settings> {
  const sizeCfg = await ConfigRepository.getByKey('notify.attach.maxSizeMB')
  const typesCfg = await ConfigRepository.getByKey('notify.attach.allowedTypes')
  const maxSizeMB = Number(sizeCfg?.config_value ?? 20) || 20
  const allowedExts = (typesCfg?.config_value || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return { maxSizeBytes: maxSizeMB * 1024 * 1024, allowedExts }
}

export class NotificationUploadService {
  static async checkFile(hash: string) {
    const exists = await NotificationAttachmentRepository.findByHash(hash)
    if (exists) return { exists: true, attachment: exists }
    const dir = path.join(CHUNK_DIR, hash)
    try {
      const files = await fs.readdir(dir)
      return { exists: false, uploadedChunks: files.map(n => Number(n)).filter(n => Number.isFinite(n)) }
    } catch {
      return { exists: false, uploadedChunks: [] }
    }
  }

  static async uploadChunk(hash: string, index: number, buffer: Buffer) {
    await ensureDir(path.join(CHUNK_DIR, hash))
    const chunkPath = path.join(CHUNK_DIR, hash, String(index))
    await fs.writeFile(chunkPath, buffer)
    return { index }
  }

  static async mergeChunks(params: {
    hash: string
    filename: string
    mime_type?: string
    totalChunks: number
    size: number
  }) {
    const settings = await loadSettings()
    if (params.size > settings.maxSizeBytes) throw new Error('文件超出允许大小')
    const ext = path.extname(params.filename || '').replace('.', '').toLowerCase()
    if (settings.allowedExts.length && ext && !settings.allowedExts.includes(ext)) throw new Error('文件类型不允许')

    const chunkDir = path.join(CHUNK_DIR, params.hash)
    const chunks = await fs.readdir(chunkDir)
    if (chunks.length !== params.totalChunks) throw new Error('分片数量不匹配')

    await ensureDir(DEST_DIR)
    const finalName = `${params.hash}${ext ? '.' + ext : ''}`
    const finalPath = path.join(DEST_DIR, finalName)
    const writeStream = await fs.open(finalPath, 'w')
    try {
      for (let i = 0; i < params.totalChunks; i += 1) {
        const chunkPath = path.join(chunkDir, String(i))
        const data = await fs.readFile(chunkPath)
        await writeStream.write(data)
      }
    } finally {
      await writeStream.close()
      await fs.rm(chunkDir, { recursive: true, force: true })
    }

    const url = `/api/uploads/notification-attachments/${finalName}`
    const id = await NotificationAttachmentRepository.insert({
      file_name: params.filename,
      file_path: finalPath,
      file_hash: params.hash,
      file_size: params.size,
      mime_type: params.mime_type ?? null,
      url,
    })
    const attachment = await NotificationAttachmentRepository.findById(id)
    return attachment
  }
}
