import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import { AnnouncementService } from '../services/announcement.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string, extra?: any): Res<T>
  created<D = any>(data?: D, message?: string, extra?: any): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  unauthorized(message?: string, extra?: any): Res<T>
  forbidden(message?: string, extra?: any): Res<T>
  notFound(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new AnnouncementService()

export class AnnouncementController {
  static async listPublic(_req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const items = await svc.listPublished()
      return res.ok({ items }, '获取公告成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取公告失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async listAdmin(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      if (!req.user?.id) return res.unauthorized('未授权')
      const items = await svc.listAll()
      return res.ok({ items }, '获取公告成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取公告失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const { title, content, status } = req.body || {}
      if (!title || !content) return res.badRequest('标题和内容不能为空', { code: CODES.VALIDATION_ERROR })
      const data = await svc.create(req.user?.id, { title, content, status })
      return res.created(data, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建公告失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.update(id, req.body || {})
      return res.ok(data, '更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新公告失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async publish(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.publish(id)
      return res.ok(data, '发布成功')
    } catch (e: any) {
      return res.internal(e?.message || '发布公告失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async remove(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove(id)
      return res.ok(null, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除公告失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
