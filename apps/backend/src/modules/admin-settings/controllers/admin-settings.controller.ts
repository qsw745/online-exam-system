/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { CODES } from '@/types/response.js'
import { AdminSettingsService } from '../services/admin-settings.service.js'

export class AdminSettingsController {
  static async getSettings(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await AdminSettingsService.getSafe()
      return (res as any).ok(data, '获取系统设置成功')
    } catch (e: any) {
      console.error('获取系统设置失败:', e)
      return (res as any).internal(e?.message || '获取系统设置失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async updateSettings(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      await AdminSettingsService.update(req.body ?? {})
      return (res as any).ok(null, '更新系统设置成功')
    } catch (e: any) {
      console.error('更新系统设置失败:', e)
      return (res as any).internal(e?.message || '更新系统设置失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  // ✅ 公开读取，给登录/注册页用，不需要 Token
  static async getPublicSettings(_req: any, res: Response<ApiResponse<any>>) {
    try {
      const full = await AdminSettingsService.getSafe()
      const data = {
        systemName: full.systemName,
        allowUserRegistration: full.allowUserRegistration,
        // 登录页策略：
        enableCaptcha: !!full.enableCaptcha,
        captchaAfterFailed: Number(full.captchaAfterFailed ?? 3),
        enableStrongPassword: !!full.enableStrongPassword,
        strongPasswordRegex: full.strongPasswordRegex || '',
        strongPasswordMinLength: Number(full.strongPasswordMinLength ?? 8),
        strongPasswordRequireUpper: !!full.strongPasswordRequireUpper,
        strongPasswordRequireLower: !!full.strongPasswordRequireLower,
        strongPasswordRequireDigit: !!full.strongPasswordRequireDigit,
        strongPasswordRequireSpecial: !!full.strongPasswordRequireSpecial,
      }
      // ✅ 用 res.set(...) 避免类型告警
      res.set('Cache-Control', 'private, max-age=60')
      return (res as any).ok(data, '获取公开系统设置成功')
    } catch (e: any) {
      console.error('获取公开系统设置失败:', e)
      return (res as any).internal(e?.message || '获取系统设置失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
