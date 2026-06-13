import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { CODES } from '@/types/response.js'
import type { Response } from 'express'
import { ProfileService } from '../services/profile.service.js'
// 🔧 本文件内增强 Response（若已有全局 augmentation，可删除这段并把 Res 改成你的全局类型）
// type Res<T = any> = Response<T> & {
//   ok<D = any>(data?: D, message?: string, extra?: any): Res<T>
//   created<D = any>(data?: D, message?: string, extra?: any): Res<T>
//   badRequest(message?: string, extra?: any): Res<T>
//   unauthorized(message?: string, extra?: any): Res<T>
//   forbidden(message?: string, extra?: any): Res<T>
//   notFound(message?: string, extra?: any): Res<T>
//   conflict(message?: string, extra?: any): Res<T>
//   internal(message?: string, extra?: any): Res<T>
//   fail(code: string, httpStatus?: number, message?: string, extra?: any): Res<T>
// }
export class ProfileController {
  static async getProfile(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      const data = await ProfileService.get(userId)
      return res.ok(data, '获取成功')
    } catch (e: any) {
      console.error('获取个人资料失败:', e)
      return res.internal(e?.message || '获取个人资料失败', { code: CODES.INTERNAL_ERROR })
    }
  }
  static async updateProfile(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      const data = await ProfileService.update(userId, req.body ?? {})
      return res.ok(data, '更新成功')
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        return res.conflict?.('邮箱已被占用') ?? res.badRequest('邮箱已被占用')
      }
      console.error('更新个人资料失败:', e)
      return res.internal(e?.message || '更新个人资料失败', { code: CODES.INTERNAL_ERROR })
    }
  }
  static async updateAvatar(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })

      // A) multipart/form-data 上传
      const file: any = (req as any).file
      if (file?.filename) {
        const publicUrl = `/api/uploads/avatars/${file.filename}`
        const data = await ProfileService.updateAvatar(userId, publicUrl)
        return res.ok(data, '更新成功')
      }

      // B) application/json 直接传 URL
      const value = String((req.body?.value ?? '') as string).trim()
      if (!value) return res.badRequest('缺少头像数据')
      const data = await ProfileService.updateAvatar(userId, value)
      return res.ok(data, '更新成功')
    } catch (e: any) {
      console.error('更新头像失败:', e)
      return res.internal(e?.message || '更新头像失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
