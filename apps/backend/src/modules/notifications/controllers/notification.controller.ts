// apps/backend/src/modules/notifications/controllers/notification.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '../../types/auth.js'
import type { ApiResponse } from '../../types/response.js'
import type { INotification, NotificationListData, UnreadCountData } from '../domain/notification.types.js'
import { NotificationService } from '../services/notification.service.js'

export class NotificationController {
  static async create(req: AuthRequest, res: Response<ApiResponse<INotification>>) {
    try {
      const currentUserId = req.user?.id
      if (!currentUserId) return res.status(401).json({ success: false, error: '未授权访问' })
      const { user_id, title, content, type = 'info' } = req.body
      const data = await NotificationService.create(currentUserId, { user_id, title, content, type })
      return res.json({ success: true, data })
    } catch (error: any) {
      const status = error?.status ?? 500
      return res.status(status).json({ success: false, error: error?.message ?? '创建通知失败' })
    }
  }

  static async createBatch(req: AuthRequest, res: Response<ApiResponse<{ count: number }>>) {
    try {
      const currentUserId = req.user?.id
      if (!currentUserId) return res.status(401).json({ success: false, error: '未授权访问' })
      const { user_ids, title, content, type = 'info' } = req.body
      const data = await NotificationService.createBatch(currentUserId, { user_ids, title, content, type })
      return res.json({ success: true, data })
    } catch (error: any) {
      const status = error?.status ?? 500
      return res.status(status).json({ success: false, error: error?.message ?? '批量创建通知失败' })
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<NotificationListData>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const data = await NotificationService.list(userId)
      return res.json({ success: true, data })
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message ?? '获取通知列表失败' })
    }
  }

  static async unreadCount(req: AuthRequest, res: Response<ApiResponse<UnreadCountData>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const data = await NotificationService.unreadCount(userId)
      return res.json({ success: true, data })
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message ?? '获取未读通知数量失败' })
    }
  }

  static async markAsRead(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const id = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(id)) return res.status(400).json({ success: false, error: '无效的通知ID' })
      const ok = await NotificationService.markAsRead(userId, id)
      if (!ok) return res.status(404).json({ success: false, error: '通知不存在' })
      return res.json({ success: true, data: null })
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message ?? '标记通知已读失败' })
    }
  }

  static async markAllAsRead(req: AuthRequest, res: Response<ApiResponse<{ count: number }>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const data = await NotificationService.markAllAsRead(userId)
      return res.json({ success: true, data })
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message ?? '批量标记已读失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const id = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(id)) return res.status(400).json({ success: false, error: '无效的通知ID' })
      const ok = await NotificationService.remove(userId, id)
      if (!ok) return res.status(404).json({ success: false, error: '通知不存在' })
      return res.json({ success: true, data: null })
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message ?? '删除通知失败' })
    }
  }

  static async adminList(req: AuthRequest, res: Response<ApiResponse<INotification[]>>) {
    try {
      const currentUserId = req.user?.id
      if (!currentUserId) return res.status(401).json({ success: false, error: '未授权访问' })
      const data = await NotificationService.adminList(currentUserId)
      return res.json({ success: true, data })
    } catch (error: any) {
      const status = error?.status ?? 500
      return res.status(status).json({ success: false, error: error?.message ?? '获取通知列表失败' })
    }
  }

  static async adminDelete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const currentUserId = req.user?.id
      const id = Number(req.params.id)
      if (!currentUserId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(id)) return res.status(400).json({ success: false, error: '无效的通知ID' })
      const ok = await NotificationService.adminDelete(currentUserId, id)
      if (!ok) return res.status(404).json({ success: false, error: '通知不存在' })
      return res.json({ success: true, data: null })
    } catch (error: any) {
      const status = error?.status ?? 500
      return res.status(status).json({ success: false, error: error?.message ?? '删除通知失败' })
    }
  }
}
