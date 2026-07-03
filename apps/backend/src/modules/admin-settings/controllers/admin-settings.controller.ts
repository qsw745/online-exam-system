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
        // 全局日期时间格式（所有页面据此统一渲染）
        dateTimeFormat: full.dateTimeFormat || 'YYYY-MM-DD HH:mm:ss',
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
        // 场景活体等级（前端据此决定是否走动作采集）
        loginLivenessLevel: full.loginLivenessLevel ?? 'silent',
        enrollLivenessLevel: full.enrollLivenessLevel ?? 'silent',
        // 水印（全站/考试页渲染用）
        watermarkEnabled: !!full.watermarkEnabled,
        watermarkScope: full.watermarkScope === 'exam' ? 'exam' : 'all',
        watermarkContent: full.watermarkContent || '{name} {time}',
        watermarkOpacity: Number(full.watermarkOpacity ?? 0.12),
        watermarkFontSize: Number(full.watermarkFontSize ?? 14),
        watermarkRotate: Number(full.watermarkRotate ?? -22),
        watermarkGap: Number(full.watermarkGap ?? 100),
        watermarkColor: full.watermarkColor || '#000000',
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
