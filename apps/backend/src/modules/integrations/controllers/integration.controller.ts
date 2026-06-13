import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import { IntegrationService } from '../services/integration.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string): Res<T>
  created<D = any>(data?: D, message?: string): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new IntegrationService()

export class IntegrationController {
  static async list(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const type = (req.query.type as string) || undefined
      const data = await svc.list(type)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取集成失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const { name, type } = req.body || {}
      if (!name || !type) return res.badRequest('缺少名称或类型', { code: CODES.VALIDATION_ERROR })
      const id = await svc.create(req.body)
      return res.created({ id }, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.update(id, req.body)
      return res.ok({ id }, '更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async remove(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove(id)
      return res.ok({ id }, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
