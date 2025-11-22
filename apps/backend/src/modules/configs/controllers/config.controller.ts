import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import { ConfigService } from '../services/config.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string): Res<T>
  created<D = any>(data?: D, message?: string): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new ConfigService()

export class ConfigController {
  static async list(_req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const data = await svc.list()
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取配置失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const { config_key, config_name } = req.body || {}
      if (!config_key || !config_name) return res.badRequest('缺少配置键或名称', { code: CODES.VALIDATION_ERROR })
      const id = await svc.create(req.body)
      return res.created({ id }, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建配置失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async update(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.update(id, req.body)
      return res.ok({ id }, '更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新配置失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async remove(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.remove(id)
      return res.ok({ id }, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除配置失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
