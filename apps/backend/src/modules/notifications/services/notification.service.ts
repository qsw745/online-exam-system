// apps/backend/src/modules/notifications/services/notification.service.ts
import type { INotification, NotificationListData } from '../domain/notification.types.js'
import { NotificationRepository } from '../repositories/notification.repository.js'
import { pool } from '@/config/database.js'
import type { RowDataPacket } from 'mysql2'
let RClient: any = null
;(async () => {
  try {
    RClient = (await import('@/common/redis/client')).default || (await import('@/common/redis/client'))
  } catch {}
})()
async function publishToUser(uid: number, payload: any) {
  try {
    await RClient?.publish?.(`ws:user:${uid}`, JSON.stringify(payload))
  } catch {}
}

export class NotificationService {
  static async create(
    currentUserId: number,
    payload: { user_id: number; title: string; content: string; type?: INotification['type'] }
  ) {
    await this.assertRole(currentUserId, ['admin', 'teacher'])
    const id = await NotificationRepository.insertOne(
      payload.user_id,
      payload.title,
      payload.content,
      payload.type ?? 'info'
    )
      const [rows] = await pool.query<INotification[]>('SELECT * FROM notifications WHERE id = ?', [id])
      await publishToUser(payload.user_id, { type: 'notify', title: payload.title, content: payload.content })

    return rows[0]
  }

  static async createBatch(
    currentUserId: number,
    payload: { user_ids: number[]; title: string; content: string; type?: INotification['type'] }
  ) {
    await this.assertRole(currentUserId, ['admin', 'teacher'])
    const values = payload.user_ids.map(
      uid => [uid, payload.title, payload.content, payload.type ?? 'info'] as [number, string, string, string]
    )
      const count = await NotificationRepository.insertMany(values)
      for (const uid of payload.user_ids) {
        await publishToUser(uid, { type: 'notify', title: payload.title, content: payload.content })
      }

    return { count }
  }

  static async list(userId: number): Promise<NotificationListData> {
    const notifications = await NotificationRepository.findByUser(userId)
    const unreadCount = await NotificationRepository.countUnread(userId)
    return { notifications, unreadCount }
  }

  static async unreadCount(userId: number) {
    return { unreadCount: await NotificationRepository.countUnread(userId) }
  }

  static async markAsRead(userId: number, id: number) {
    const ok = await NotificationRepository.markRead(userId, id)
    return ok
  }

  static async markAllAsRead(userId: number) {
    const count = await NotificationRepository.markAllRead(userId)
    return { count }
  }

  static async remove(userId: number, id: number) {
    const ok = await NotificationRepository.deleteOne(userId, id)
    return ok
  }

  static async adminList(currentUserId: number) {
    await this.assertRole(currentUserId, ['admin'])
    return await NotificationRepository.adminListAll()
  }

  static async adminDelete(currentUserId: number, id: number) {
    await this.assertRole(currentUserId, ['admin'])
    return await NotificationRepository.adminDeleteById(id)
  }

  static async createSystemNotification(
    type: 'exam_start' | 'exam_end' | 'grade_published' | 'task_assigned',
    data: any
  ) {
    const templates = {
      exam_start: {
        title: '考试开始提醒',
        content: `考试「${data.examTitle}」即将开始，请准时参加。开始时间：${data.startTime}`,
      },
      exam_end: { title: '考试结束提醒', content: `考试「${data.examTitle}」已结束，感谢您的参与。` },
      grade_published: {
        title: '成绩发布通知',
        content: `考试「${data.examTitle}」的成绩已发布，您的得分为：${data.score}分。`,
      },
      task_assigned: {
        title: '新任务分配',
        content: `您有新的任务「${data.taskTitle}」，请及时完成。截止时间：${data.deadline}`,
      },
    } as const
    const t = (templates as any)[type]
    if (!t) throw new Error('未知的通知类型')

    const values = data.userIds.map(
      (uid: number) => [uid, t.title, t.content, 'info'] as [number, string, string, string]
    )
    const count = await NotificationRepository.insertMany(values)
    return { success: true, count }
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
