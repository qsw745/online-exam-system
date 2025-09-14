import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { ProfileService } from '../services/profile.service.js'

export class ProfileController {
    static async getProfile(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const userId = req.user?.id
            if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
            const data = await ProfileService.get(userId)
            return res.json({ success: true, data })
        } catch (e) {
            console.error('获取个人资料失败:', e)
            return res.status(500).json({ success: false, error: '获取个人资料失败' })
        }
    }

    static async updateProfile(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const userId = req.user?.id
            if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
            const data = await ProfileService.update(userId, req.body ?? {})
            return res.json({ success: true, data })
        } catch (e: any) {
            if (e?.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, error: '邮箱已被占用' })
            }
            console.error('更新个人资料失败:', e)
            return res.status(500).json({ success: false, error: '更新个人资料失败' })
        }
    }

    static async updateAvatar(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const userId = req.user?.id
            if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })

            // A) multipart/form-data 上传文件
            const file: any = (req as any).file
            if (file?.filename) {
                // 与 app.ts 中静态目录 /api/uploads 对齐
                const publicUrl = `/api/uploads/avatars/${file.filename}`
                const data = await ProfileService.updateAvatar(userId, publicUrl)
                return res.json({ success: true, data })
            }

            // B) application/json 方式（直接传 URL）
            const value = String((req.body?.value ?? '') as string).trim()
            if (!value) return res.status(400).json({ success: false, error: '缺少头像数据' })
            const data = await ProfileService.updateAvatar(userId, value)
            return res.json({ success: true, data })
        } catch (e) {
            console.error('更新头像失败:', e)
            return res.status(500).json({ success: false, error: '更新头像失败' })
        }
    }
}
