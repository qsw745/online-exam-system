import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import { DictService } from '../services/dict.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string): Res<T>
  created<D = any>(data?: D, message?: string): Res<T>
  badRequest(message?: string, extra?: any): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new DictService()

export class DictController {
  static async list(_req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const data = await svc.list()
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取字典失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async create(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const { code, name } = req.body || {}
      if (!code || !name) return res.badRequest('缺少编码或名称', { code: CODES.VALIDATION_ERROR })
      const id = await svc.create(req.body)
      return res.created({ id }, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建字典失败', { code: CODES.INTERNAL_ERROR })
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

  static async listItems(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const dictId = Number(req.params.dictId)
      if (!Number.isFinite(dictId)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      const data = await svc.listItems(dictId)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async createItem(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const dictId = Number(req.params.dictId)
      if (!Number.isFinite(dictId)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      const { label, value } = req.body || {}
      if (!label || !value) return res.badRequest('缺少标签或值', { code: CODES.VALIDATION_ERROR })
      const id = await svc.createItem(dictId, req.body)
      return res.created({ id }, '创建成功')
    } catch (e: any) {
      return res.internal(e?.message || '创建失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async updateItem(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.itemId)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.updateItem(id, req.body)
      return res.ok({ id }, '更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async removeItem(req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const id = Number(req.params.itemId)
      if (!Number.isFinite(id)) return res.badRequest('无效ID', { code: CODES.VALIDATION_ERROR })
      await svc.removeItem(id)
      return res.ok({ id }, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
