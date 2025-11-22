import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { NotificationUploadService } from '../services/notification-upload.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string): Res<T>
  created<D = any>(data?: D, message?: string): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

export class NotificationUploadController {
  static async check(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const hash = String((req.body as any)?.hash || '').trim()
      if (!hash) return res.badRequest('缺少文件 hash', { code: CODES.VALIDATION_ERROR })
      const data = await NotificationUploadService.checkFile(hash)
      return res.ok(data)
    } catch (e: any) {
      return res.internal(e?.message || '检查文件失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async uploadChunk(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const hash = String((req.body as any)?.hash || '').trim()
      const index = Number((req.body as any)?.index ?? -1)
      if (!hash || !Number.isFinite(index) || index < 0)
        return res.badRequest('缺少必要参数', { code: CODES.VALIDATION_ERROR })
      const file = (req as any).file
      if (!file) return res.badRequest('缺少分片数据', { code: CODES.VALIDATION_ERROR })
      await NotificationUploadService.uploadChunk(hash, index, (file as Express.Multer.File).buffer)
      return res.ok({ index }, '上传成功')
    } catch (e: any) {
      return res.internal(e?.message || '上传分片失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async merge(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const { hash, filename, mime_type, totalChunks, size } = req.body || {}
      if (!hash || !filename || !Number.isFinite(Number(totalChunks)))
        return res.badRequest('缺少必要参数', { code: CODES.VALIDATION_ERROR })
      const attachment = await NotificationUploadService.mergeChunks({
        hash,
        filename,
        mime_type,
        totalChunks: Number(totalChunks),
        size: Number(size || 0),
      })
      return res.ok({ attachment }, '合并成功')
    } catch (e: any) {
      return res.internal(e?.message || '合并失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
