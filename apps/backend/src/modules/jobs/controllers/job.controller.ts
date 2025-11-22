import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import { JobService } from '../services/job.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string): Res<T>
  created<D = any>(data?: D, message?: string): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new JobService()

export class JobController {
  static async list(_req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const data = await svc.list()
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const { name, cron, handler } = req.body || {}
      if (!name || !cron || !handler) return res.badRequest('缺少必填字段', { code: CODES.VALIDATION_ERROR })
      const id = await svc.create(req.body)
      return res.created({ id }, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.update(id, req.body)
      return res.ok({ id }, '更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async remove(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove(id)
      return res.ok({ id }, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除任务失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
