// apps/backend/src/modules/messages/controllers/message.controller.ts
import type { AuthRequest } from '@/types/auth.js'
import type { Res } from '@/types/response.js'
import type { IMessage, MessageListData, UnreadCountData } from '../domain/message.model'
import { MessageService } from '../services/message.service.js'

export class MessageController {
  static async create(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const { user_id, title, content, type = 'info' } = req.body
      const data = await MessageService.create(uid, { user_id, title, content, type })
      return res.ok<IMessage>(data)
    } catch (e: any) {
      return res.internal(e?.message || '创建消息失败')
    }
  }

  static async createBatch(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const { user_ids, title, content, type = 'info' } = req.body
      const data = await MessageService.createBatch(uid, { user_ids, title, content, type })
      return res.ok<{ count: number }>(data)
    } catch (e: any) {
      return res.internal(e?.message || '批量创建消息失败')
    }
  }

  static async list(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = await MessageService.list(uid)
      return res.ok<MessageListData>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取消息列表失败')
    }
  }

  static async unreadCount(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = await MessageService.unreadCount(uid)
      return res.ok<UnreadCountData>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取未读消息数量失败')
    }
  }

  static async markAsRead(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      const id = Number(req.params.id)
      if (!uid) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的消息ID')
      const ok = await MessageService.markAsRead(uid, id)
      if (!ok) return res.notFound('消息不存在')
      return res.ok<null>(null, '已标记为已读')
    } catch (e: any) {
      return res.internal(e?.message || '标记消息已读失败')
    }
  }

  static async markAllAsRead(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = await MessageService.markAllAsRead(uid)
      return res.ok<{ count: number }>(data)
    } catch (e: any) {
      return res.internal(e?.message || '批量标记已读失败')
    }
  }

  static async delete(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      const id = Number(req.params.id)
      if (!uid) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的消息ID')
      const ok = await MessageService.remove(uid, id)
      if (!ok) return res.notFound('消息不存在')
      return res.ok<null>(null, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除消息失败')
    }
  }

  // ---- admin
  static async adminList(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      if (!uid) return res.unauthorized('未授权访问')
      const data = (await MessageService.adminList(uid)) as unknown as IMessage[]
      return res.ok<IMessage[]>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取消息列表失败')
    }
  }

  static async adminDelete(req: AuthRequest, res: Res) {
    try {
      const uid = req.user?.id
      const id = Number(req.params.id)
      if (!uid) return res.unauthorized('未授权访问')
      if (Number.isNaN(id)) return res.badRequest('无效的消息ID')
      const ok = await MessageService.adminDelete(uid, id)
      if (!ok) return res.notFound('消息不存在')
      return res.ok<null>(null, '删除成功')
    } catch (e: any) {
      return res.internal(e?.message || '删除消息失败')
    }
  }
}
