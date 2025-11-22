import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import { FileService } from '../services/file.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string, extra?: any): Res<T>
  created<D = any>(data?: D, message?: string, extra?: any): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  fail(code: string, httpStatus?: number, message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new FileService()

const toNumber = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

export class FileController {
  static async list(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const parentId = toNumber(req.query.parentId ?? req.query.parent_id ?? null)
      const page = req.query.page ? Number(req.query.page) : undefined
      const limit = req.query.limit ? Number(req.query.limit) : undefined
      const data = await svc.listLibrary({
        parentId,
        search: (req.query.search as string) || undefined,
        type: (req.query.type as 'file' | 'folder') || undefined,
        page,
        limit,
      })
      return res.ok(data, '获取文件成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取文件列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listUploads(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const data = await svc.listUploads({
        search: (req.query.search as string) || undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      })
      return res.ok(data, '获取上传记录成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取上传记录失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async createFolder(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const name = (req.body?.name as string) || ''
      const parent_id = toNumber(req.body?.parent_id ?? req.body?.parentId ?? null)
      const data = await svc.createFolder({ id: req.user?.id }, { name, parent_id })
      return res.created(data, '创建文件夹成功')
    } catch (e: any) {
      if (/存在同名|不能为空/.test(e?.message || '')) return res.badRequest(e?.message || '无法创建文件夹')
      return res.internal(e?.message || '创建文件夹失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async uploadFile(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const file = (req as AuthRequest & { file?: Express.Multer.File }).file
      if (!file) return res.badRequest('请上传文件', { code: CODES.VALIDATION_ERROR })
      const payload = {
        file,
        parent_id: toNumber((req.body as any)?.parent_id ?? (req.body as any)?.parentId ?? null),
        name: (req.body as any)?.name,
        description: (req.body as any)?.description,
        tags: (req.body as any)?.tags,
      }
      const data = await svc.saveUploadedFile({ id: req.user?.id }, payload)
      return res.created(data, '上传成功')
    } catch (e: any) {
      return res.internal(e?.message || '上传文件失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的ID', { code: CODES.VALIDATION_ERROR })
      const parentRaw = req.body?.parent_id ?? req.body?.parentId
      const parent_id = parentRaw === undefined ? undefined : toNumber(parentRaw)
      const data = await svc.updateFile({ id: req.user?.id }, id, {
        name: req.body?.name,
        parent_id,
        description: req.body?.description,
        tags: req.body?.tags,
      })
      return res.ok(data, '更新成功')
    } catch (e: any) {
      if (/不存在|同名|自身/.test(e?.message || '')) return res.badRequest(e?.message || '更新失败')
      return res.internal(e?.message || '更新文件失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async remove(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效的ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove({ id: req.user?.id }, id)
      return res.ok(null, '删除成功')
    } catch (e: any) {
      if (/不存在|文件夹非空/.test(e?.message || '')) return res.badRequest(e?.message || '删除失败')
      return res.internal(e?.message || '删除文件失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
