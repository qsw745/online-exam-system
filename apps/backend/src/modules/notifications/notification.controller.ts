import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

interface INotification extends RowDataPacket {
  id: number
  user_id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_read: boolean
  created_at: Date
  updated_at: Date
}

type NotificationData = {
  notifications: INotification[]
  unreadCount: number
}

type UnreadCountData = {
  unreadCount: number
}

export class NotificationController {
  // 创建通知
  static async create(req: AuthRequest, res: Response<ApiResponse<INotification>>) {
    try {
      const { user_id, title, content, type = 'info' } = req.body
      const currentUserId = req.user?.id

      if (!currentUserId) {
        const errorResponse: ApiResponse<INotification> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      // 检查是否为管理员或教师
      const [userInfo] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [currentUserId])

      if (!userInfo[0] || !['admin', 'teacher'].includes(userInfo[0].role)) {
        const errorResponse: ApiResponse<INotification> = {
          success: false,
          error: '权限不足',
        }
        return res.status(403).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)',
        [user_id, title, content, type]
      )

      const [notification] = await pool.query<INotification[]>('SELECT * FROM notifications WHERE id = ?', [
        result.insertId,
      ])

      const successResponse: ApiResponse<INotification> = {
        success: true,
        data: notification[0],
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('创建通知错误:', error)
      const errorResponse: ApiResponse<INotification> = {
        success: false,
        error: error instanceof Error ? error.message : '创建通知失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 批量创建通知
  static async createBatch(req: AuthRequest, res: Response<ApiResponse<{ count: number }>>) {
    try {
      const { user_ids, title, content, type = 'info' } = req.body
      const currentUserId = req.user?.id

      if (!currentUserId) {
        const errorResponse: ApiResponse<{ count: number }> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      // 检查是否为管理员或教师
      const [userInfo] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [currentUserId])

      if (!userInfo[0] || !['admin', 'teacher'].includes(userInfo[0].role)) {
        const errorResponse: ApiResponse<{ count: number }> = {
          success: false,
          error: '权限不足',
        }
        return res.status(403).json(errorResponse)
      }

      const values = user_ids.map((userId: number) => [userId, title, content, type])
      const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ')
      const flatValues = values.flat()

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO notifications (user_id, title, content, type) VALUES ${placeholders}`,
        flatValues
      )

      const successResponse: ApiResponse<{ count: number }> = {
        success: true,
        data: { count: result.affectedRows },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('批量创建通知错误:', error)
      const errorResponse: ApiResponse<{ count: number }> = {
        success: false,
        error: error instanceof Error ? error.message : '批量创建通知失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<NotificationData>>) {
    try {
      const userId = req.user?.id

      if (!userId) {
        const errorResponse: ApiResponse<NotificationData> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      const [notifications] = await pool.query<INotification[]>(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      )

      const [unreadCount] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false',
        [userId]
      )

      const successResponse: ApiResponse<NotificationData> = {
        success: true,
        data: {
          notifications,
          unreadCount: unreadCount[0].count,
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取通知列表错误:', error)
      const errorResponse: ApiResponse<NotificationData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取通知列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async unreadCount(req: AuthRequest, res: Response<ApiResponse<UnreadCountData>>) {
    try {
      const userId = req.user?.id

      if (!userId) {
        const errorResponse: ApiResponse<UnreadCountData> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      const [result] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false',
        [userId]
      )

      const successResponse: ApiResponse<UnreadCountData> = {
        success: true,
        data: { unreadCount: result[0].count },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取未读通知数量错误:', error)
      const errorResponse: ApiResponse<UnreadCountData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取未读通知数量失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async markAsRead(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const notificationId = parseInt(req.params.id)

      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (isNaN(notificationId)) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的通知ID',
        }
        return res.status(400).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      )

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '通知不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('标记通知已读错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '标记通知已读失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 批量标记已读
  static async markAllAsRead(req: AuthRequest, res: Response<ApiResponse<{ count: number }>>) {
    try {
      const userId = req.user?.id

      if (!userId) {
        const errorResponse: ApiResponse<{ count: number }> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false',
        [userId]
      )

      const successResponse: ApiResponse<{ count: number }> = {
        success: true,
        data: { count: result.affectedRows },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('批量标记已读错误:', error)
      const errorResponse: ApiResponse<{ count: number }> = {
        success: false,
        error: error instanceof Error ? error.message : '批量标记已读失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 删除通知
  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const notificationId = parseInt(req.params.id)

      if (!userId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      if (isNaN(notificationId)) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的通知ID',
        }
        return res.status(400).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>('DELETE FROM notifications WHERE id = ? AND user_id = ?', [
        notificationId,
        userId,
      ])

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '通知不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('删除通知错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '删除通知失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 管理员获取所有通知
  static async adminList(req: AuthRequest, res: Response<ApiResponse<INotification[]>>) {
    try {
      const currentUserId = req.user?.id

      if (!currentUserId) {
        const errorResponse: ApiResponse<INotification[]> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      // 检查是否为管理员
      const [userInfo] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [currentUserId])

      if (!userInfo[0] || userInfo[0].role !== 'admin') {
        const errorResponse: ApiResponse<INotification[]> = {
          success: false,
          error: '权限不足',
        }
        return res.status(403).json(errorResponse)
      }

      const [notifications] = await pool.query<INotification[]>(
        `SELECT n.*, u.username, u.real_name 
         FROM notifications n 
         LEFT JOIN users u ON n.user_id = u.id 
         ORDER BY n.created_at DESC`
      )

      const successResponse: ApiResponse<INotification[]> = {
        success: true,
        data: notifications,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取通知列表错误:', error)
      const errorResponse: ApiResponse<INotification[]> = {
        success: false,
        error: error instanceof Error ? error.message : '获取通知列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 管理员删除通知
  static async adminDelete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const currentUserId = req.user?.id
      const notificationId = parseInt(req.params.id)

      if (!currentUserId) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '未授权访问',
        }
        return res.status(401).json(errorResponse)
      }

      // 检查是否为管理员
      const [userInfo] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [currentUserId])

      if (!userInfo[0] || userInfo[0].role !== 'admin') {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '权限不足',
        }
        return res.status(403).json(errorResponse)
      }

      if (isNaN(notificationId)) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '无效的通知ID',
        }
        return res.status(400).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>('DELETE FROM notifications WHERE id = ?', [notificationId])

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          error: '通知不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('删除通知错误:', error)
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : '删除通知失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  // 系统通知模板
  static async createSystemNotification(
    type: 'exam_start' | 'exam_end' | 'grade_published' | 'task_assigned',
    data: any
  ) {
    try {
      const templates = {
        exam_start: {
          title: '考试开始提醒',
          content: `考试「${data.examTitle}」即将开始，请准时参加。开始时间：${data.startTime}`,
        },
        exam_end: {
          title: '考试结束提醒',
          content: `考试「${data.examTitle}」已结束，感谢您的参与。`,
        },
        grade_published: {
          title: '成绩发布通知',
          content: `考试「${data.examTitle}」的成绩已发布，您的得分为：${data.score}分。`,
        },
        task_assigned: {
          title: '新任务分配',
          content: `您有新的任务「${data.taskTitle}」，请及时完成。截止时间：${data.deadline}`,
        },
      }

      const template = templates[type]
      if (!template) {
        throw new Error('未知的通知类型')
      }

      const values = data.userIds.map((userId: number) => [userId, template.title, template.content, 'info'])
      const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ')
      const flatValues = values.flat()

      await pool.query<ResultSetHeader>(
        `INSERT INTO notifications (user_id, title, content, type) VALUES ${placeholders}`,
        flatValues
      )

      return { success: true, count: values.length }
    } catch (error) {
      console.error('创建系统通知错误:', error)
      throw error
    }
  }
}
