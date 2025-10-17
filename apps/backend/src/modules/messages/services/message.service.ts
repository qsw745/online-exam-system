// apps/backend/src/modules/messages/services/message.service.ts
import type { IMessage, MessageListData } from '../domain/message.model'
import { MessageRepository } from '../repositories/message.repository.js'
import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2'

export class MessageService {
  static async create(
    currentUserId: number,
    payload: { user_id: number; title: string; content: string; type?: IMessage['type'] }
  ) {
    await this.assertRole(currentUserId, ['admin', 'teacher'])
    const id = await MessageRepository.insertOne(
      payload.user_id,
      payload.title,
      payload.content,
      payload.type ?? 'info'
    )
    const [rows] = await pool.query<IMessage[]>('SELECT * FROM messages WHERE id = ?', [id])
    return rows[0]
  }

  static async createBatch(
    currentUserId: number,
    payload: { user_ids: number[]; title: string; content: string; type?: IMessage['type'] }
  ) {
    await this.assertRole(currentUserId, ['admin', 'teacher'])
    const values = payload.user_ids.map(
      uid => [uid, payload.title, payload.content, payload.type ?? 'info'] as [number, string, string, string]
    )
    const count = await MessageRepository.insertMany(values)
    return { count }
  }

  static async list(userId: number): Promise<MessageListData> {
    const messages = await MessageRepository.findByUser(userId)
    const unreadCount = await MessageRepository.countUnread(userId)
    return { messages, unreadCount }
  }

  static async unreadCount(userId: number) {
    return { unreadCount: await MessageRepository.countUnread(userId) }
  }

  static async markAsRead(userId: number, id: number) {
    return await MessageRepository.markRead(userId, id)
  }

  static async markAllAsRead(userId: number) {
    const count = await MessageRepository.markAllRead(userId)
    return { count }
  }

  static async remove(userId: number, id: number) {
    return await MessageRepository.deleteOne(userId, id)
  }

  // admin
  static async adminList(currentUserId: number) {
    await this.assertRole(currentUserId, ['admin'])
    return await MessageRepository.adminListAll()
  }
  static async adminDelete(currentUserId: number, id: number) {
    await this.assertRole(currentUserId, ['admin'])
    return await MessageRepository.adminDeleteById(id)
  }

  private static async assertRole(userId: number, roles: string[]) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [userId])
    const role = rows[0]?.role
    if (!role || !roles.includes(role)) {
      const err: any = new Error('权限不足')
      err.status = 403
      throw err
    }
  }
}
