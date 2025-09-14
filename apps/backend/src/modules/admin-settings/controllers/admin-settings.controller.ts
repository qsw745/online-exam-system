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
}
