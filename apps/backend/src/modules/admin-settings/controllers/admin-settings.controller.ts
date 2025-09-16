import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { AdminSettingsService } from '../services/admin-settings.service.js'

export class AdminSettingsController {
    static async getSettings(_req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const data = await AdminSettingsService.getSafe()
            return res.json({ success: true, data })
        } catch (e) {
            console.error('获取系统设置失败:', e)
            return res.status(500).json({ success: false, error: '获取系统设置失败' })
        }
    }

    static async updateSettings(req: AuthRequest, res: Response<ApiResponse<null>>) {
        try {
            await AdminSettingsService.update(req.body ?? {})
            return res.json({ success: true, data: null })
        } catch (e) {
            console.error('更新系统设置失败:', e)
            return res.status(500).json({ success: false, error: '更新系统设置失败' })
        }
    }
    // ✅ 新增：公开读取，给登录/注册页用，不需要 Token
    static async getPublicSettings(_req: any, res: Response<ApiResponse<any>>) {
        try {
            const full = await AdminSettingsService.getSafe()
            // 仅挑登录前需要的、安全的字段
            const data = {
                systemName: full.systemName,
                allowUserRegistration: full.allowUserRegistration,
                // 登录页需要的策略：
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
            // 可选：给一点短缓存
            res.setHeader('Cache-Control', 'private, max-age=60')
            return res.json({ success: true, data })
        } catch (e) {
            console.error('获取公开系统设置失败:', e)
            return res.status(500).json({ success: false, error: '获取系统设置失败' })
        }
    }
}
