import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import { CacheService } from '../services/cache.service'

type Res<T = any> = Response<T> & {
  ok<D = any>(data?: D, message?: string): Res<T>
  internal(message?: string, extra?: any): Res<T>
}

const svc = new CacheService()

export class CacheController {
  static async stats(_req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const data = await svc.stats()
      return res.ok(data, '获取缓存信息成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取缓存信息失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async flush(_req: AuthRequest, res: Res<ApiResponse<any>>) {
    try {
      const ok = await svc.flushAll()
      if (!ok) return res.internal('清空缓存失败', { code: CODES.INTERNAL_ERROR })
      return res.ok({ flushed: true }, '缓存已清空')
    } catch (e: any) {
      return res.internal(e?.message || '清空缓存失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
