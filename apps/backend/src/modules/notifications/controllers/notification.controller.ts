// apps/backend/src/modules/notifications/controllers/notification.controller.ts
import type { AuthRequest } from '@/types/auth.js'
import type { Res } from '@/types/response.js'
import type { INotification, NotificationListData, UnreadCountData } from '../domain/notification.types.js'
import { NotificationService } from '../services/notification.service.js'

export class NotificationController {
  static async create(req: AuthRequest, res: Res) {
    try {
      const currentUserId = req.user?.id
      if (!currentUserId) return res.unauthorized('未授权访问')
      const { user_id, title, content, type = 'info' } = req.body
      const data = await NotificationService.create(currentUserId, { user_id, title, content, type })
      return res.ok<INotification>(data)
    } catch (error: any) {
      const status = error?.status ?? 500
      if (status === 401) return res.unauthorized(error?.message || '创建通知失败')
      if (status === 403) return res.forbidden(error?.message || '创建通知失败')
      if (status >= 400 && status < 500) return res.badRequest(error?.message || '创建通知失败')
      return res.internal(error?.message || '创建通知失败')
    }
  }

  static async createBatch(req: AuthRequest, res: Res) {
    try {
      const currentUserId = req.user?.id
      if (!currentUserId) return res.unauthorized('未授权访问')
      const { user_ids, title, content, type = 'info' } = req.body
      const data = await NotificationService.createBatch(currentUserId, { user_ids, title, content, type })
      return res.ok<{ count: number }>(data)
    } catch (error: any) {
      return res.internal(error?.message || '批量创建通知失败')
    }
  }

  static async list(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const data = await NotificationService.list(userId)
      return res.ok<NotificationListData>(data)
    } catch (error: any) {
      return res.internal(error?.message || '获取通知列表失败')
    }
  }

  static async unreadCount(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const data = await NotificationService.unreadCount(userId)
      return res.ok<UnreadCountData>(data)
    } catch (error: any) {
      return res.internal(error?.message || '获取未读通知数量失败')
    }
  }
  static async markAsRead(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      const id = Number(req.params.id)
      if (!userId) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的通知ID')
      const ok = await NotificationService.markAsRead(userId, id)
      if (!ok) return res.notFound('通知不存在')
      return res.ok<null>(null, '已标记为已读')
    } catch (error: any) {
      return res.internal(error?.message || '标记通知已读失败')
    }
  }

  static async markAllAsRead(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const data = await NotificationService.markAllAsRead(userId)
      return res.ok<{ count: number }>(data)
    } catch (error: any) {
      return res.internal(error?.message || '批量标记已读失败')
    }
  }

  static async delete(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      const id = Number(req.params.id)
      if (!userId) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的通知ID')
      const ok = await NotificationService.remove(userId, id)
      if (!ok) return res.notFound('通知不存在')
      return res.ok<null>(null, '删除成功')
    } catch (error: any) {
      return res.internal(error?.message || '删除通知失败')
    }
  }

  static async adminList(req: AuthRequest, res: Res) {
    try {
      const currentUserId = req.user?.id
      if (!currentUserId) return res.unauthorized('未授权访问')
      // 如果 service 返回 RowDataPacket[]，在此处做一次断言或在 service 层改类型
      const data = (await NotificationService.adminList(currentUserId)) as unknown as INotification[]
      return res.ok<INotification[]>(data)
    } catch (error: any) {
      const status = error?.status ?? 500
      if (status === 401) return res.unauthorized(error?.message || '获取通知列表失败')
      if (status === 403) return res.forbidden(error?.message || '获取通知列表失败')
      if (status >= 400 && status < 500) return res.badRequest(error?.message || '获取通知列表失败')
      return res.internal(error?.message || '获取通知列表失败')
    }
  }

  static async adminDelete(req: AuthRequest, res: Res) {
    try {
      const currentUserId = req.user?.id
      const id = Number(req.params.id)
      if (!currentUserId) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的通知ID')
      const ok = await NotificationService.adminDelete(currentUserId, id)
      if (!ok) return res.notFound('通知不存在')
      return res.ok<null>(null, '删除成功')
    } catch (error: any) {
      const status = error?.status ?? 500
      if (status >= 400 && status < 500) return res.badRequest(error?.message || '删除通知失败')
      return res.internal(error?.message || '删除通知失败')
    }
  }
}
