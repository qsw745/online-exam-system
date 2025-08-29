import bcrypt from 'bcryptjs'
import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/database.js'
import { LoggerService } from '../services/logger.service.js'
import { AuthRequest } from '../types/auth.js'
import { ApiResponse } from '../types/response.js'

interface IUser extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  role: 'admin' | 'teacher' | 'student'
  nickname?: string
  school?: string
  class_name?: string
  experience_points: number
  level: number
  avatar_url?: string
  status: 'active' | 'disabled'
  created_at: Date
  updated_at: Date
}

type UserData = Omit<IUser, 'password'> & {
  statistics?: {
    totalSubmissions: number
    completedSubmissions: number
    averageScore: number
  }
}

type UserListData = {
  users: Omit<IUser, 'password'>[]
  total: number
  page: number
  limit: number
}

interface UserSettings {
  notifications?: {
    email: boolean
    push: boolean
    sound: boolean
  }
  privacy?: {
    profile_visibility: 'public' | 'private'
    show_activity: boolean
    show_results: boolean
  }
  appearance?: {
    theme?: 'light' | 'dark'
    language?: string
  }
}

export class UserController {
  static async getById(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      const { id } = req.params

      const [users] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, status,school, class_name, experience_points, level, avatar_url, created_at, updated_at FROM users WHERE id = ?',
        [parseInt(id)]
      )

      if (users.length === 0) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '用户不存在',
        }
        return res.status(404).json(errorResponse)
      }

      // 获取用户的统计信息
      const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as totalSubmissions,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completedSubmissions,
          AVG(CASE WHEN score IS NOT NULL THEN score ELSE 0 END) as averageScore
        FROM exam_results 
        WHERE user_id = ?`,
        [parseInt(id)]
      )

      const userData = {
        ...users[0],
        statistics: {
          totalSubmissions: stats[0]?.totalSubmissions || 0,
          completedSubmissions: stats[0]?.completedSubmissions || 0,
          averageScore: stats[0]?.averageScore || 0,
        },
      }

      const successResponse: ApiResponse<UserData> = {
        success: true,
        data: userData,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取用户详情错误:', error)
      const errorResponse: ApiResponse<UserData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取用户详情失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async getCurrentUser(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      if (!req.user?.id) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      const [users] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, status, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      )

      if (users.length === 0) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '用户不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const successResponse: ApiResponse<UserData> = {
        success: true,
        data: users[0],
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取当前用户信息错误:', error)
      const errorResponse: ApiResponse<UserData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取用户信息失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async updateCurrentUser(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      if (!req.user?.id) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      const { nickname, school, class_name } = req.body
      const updates: string[] = []
      const values: any[] = []

      if (nickname !== undefined) {
        updates.push('nickname = ?')
        values.push(nickname)
      }
      if (school !== undefined) {
        updates.push('school = ?')
        values.push(school)
      }
      if (class_name !== undefined) {
        updates.push('class_name = ?')
        values.push(class_name)
      }

      if (updates.length === 0) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '没有提供要更新的字段',
        }
        return res.status(400).json(errorResponse)
      }

      values.push(req.user.id)
      await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)

      const [updatedUsers] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, status, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      )
      const avatarUrl = req.body?.avatarUrl ?? null

      // 记录头像上传操作日志
      await LoggerService.logUserAction({
        userId: req.user.id,
        username: req.user.username,
        action: 'upload_avatar',
        resourceType: 'user',
        resourceId: Number(req.user.id),
        details: { avatarUrl },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const successResponse: ApiResponse<UserData> = {
        success: true,
        data: updatedUsers[0],
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('更新当前用户信息错误:', error)
      const errorResponse: ApiResponse<UserData> = {
        success: false,
        error: error instanceof Error ? error.message : '更新用户信息失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      if (!req.user?.id) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      if (!req.file) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '没有提供头像文件',
        }
        return res.status(400).json(errorResponse)
      }

      // 使用完整的URL路径，确保前端可以正确访问
      // 获取服务器的基础URL
      const baseUrl = process.env.API_URL || 'http://localhost:3000'
      const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`

      await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [avatarUrl, req.user.id])

      const [updatedUsers] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      )

      const successResponse: ApiResponse<UserData> = {
        success: true,
        data: updatedUsers[0],
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('上传头像错误:', error)
      const errorResponse: ApiResponse<UserData> = {
        success: false,
        error: error instanceof Error ? error.message : '上传头像失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async list(req: AuthRequest, res: Response<ApiResponse<UserListData>>) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const role = req.query.role as 'admin' | 'teacher' | 'student' | undefined
      const search = req.query.search as string | undefined

      const offset = (page - 1) * limit
      const conditions: string[] = []
      const values: any[] = []

      if (role) {
        conditions.push('role = ?')
        values.push(role)
      }

      if (search) {
        conditions.push('(username LIKE ? OR email LIKE ? OR nickname LIKE ?)')
        values.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const [users] = await pool.query<IUser[]>(
        `SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, status, created_at, updated_at 
         FROM users ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      )

      const [totalRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        values
      )

      const successResponse: ApiResponse<UserListData> = {
        success: true,
        data: {
          users,
          total: totalRows[0].total,
          page,
          limit,
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取用户列表错误:', error)
      const errorResponse: ApiResponse<UserListData> = {
        success: false,
        error: error instanceof Error ? error.message : '获取用户列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '无效的用户ID',
        }
        return res.status(400).json(errorResponse)
      }

      const { username, email, role, avatar_url, nickname, school, class_name } = req.body
      const updates: string[] = []
      const values: any[] = []

      if (username) {
        updates.push('username = ?')
        values.push(username)
      }
      if (email) {
        updates.push('email = ?')
        values.push(email)
      }
      if (role && ['admin', 'teacher', 'student'].includes(role)) {
        updates.push('role = ?')
        values.push(role)
      }
      if (avatar_url) {
        updates.push('avatar_url = ?')
        values.push(avatar_url)
      }
      // 添加对nickname、school和class_name字段的处理
      if (nickname !== undefined) {
        updates.push('nickname = ?')
        values.push(nickname)
      }
      if (school !== undefined) {
        updates.push('school = ?')
        values.push(school)
      }
      if (class_name !== undefined) {
        updates.push('class_name = ?')
        values.push(class_name)
      }

      if (updates.length === 0) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '没有提供要更新的字段',
        }
        return res.status(400).json(errorResponse)
      }

      values.push(userId)
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      )

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<UserData> = {
          success: false,
          error: '用户不存在',
        }
        return res.status(404).json(errorResponse)
      }

      const [updatedUser] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, status, created_at, updated_at FROM users WHERE id = ?',
        [userId]
      )

      // 记录用户更新操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'update_user',
        resourceType: 'user',
        resourceId: userId,
        details: { updatedFields: updates, targetUserId: userId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const successResponse: ApiResponse<UserData> = {
        success: true,
        data: updatedUser[0],
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('更新用户信息错误:', error)
      const errorResponse: ApiResponse<UserData> = {
        success: false,
        error: error instanceof Error ? error.message : '更新用户信息失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async updateStatus(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '无效的用户ID',
        }
        return res.status(400).json(errorResponse)
      }

      const { status } = req.body
      if (!status || !['active', 'disabled'].includes(status)) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '无效的状态值',
        }
        return res.status(400).json(errorResponse)
      }

      // 检查用户是否存在
      const [users] = await pool.query<IUser[]>('SELECT id, role FROM users WHERE id = ?', [userId])

      if (users.length === 0) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '用户不存在',
        }
        return res.status(404).json(errorResponse)
      }

      // 保护admin账号不被禁用
      if (users[0].role === 'admin' && status === 'disabled') {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '管理员账号不允许禁用',
        }
        return res.status(403).json(errorResponse)
      }

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, userId]
      )

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '更新用户状态失败',
        }
        return res.status(500).json(errorResponse)
      }

      // 记录用户状态更新操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'update_user_status',
        resourceType: 'user',
        resourceId: userId,
        details: { newStatus: status, targetUserId: userId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const successResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: `用户状态已更新为${status === 'active' ? '启用' : '禁用'}` },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('更新用户状态错误:', error)
      const errorResponse: ApiResponse<{ message: string }> = {
        success: false,
        error: error instanceof Error ? error.message : '更新用户状态失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async resetPassword(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '无效的用户ID',
        }
        return res.status(400).json(errorResponse)
      }

      // 检查用户是否存在
      const [users] = await pool.query<IUser[]>('SELECT id, email FROM users WHERE id = ?', [userId])

      if (users.length === 0) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '用户不存在',
        }
        return res.status(404).json(errorResponse)
      }

      // 获取系统默认密码（这里暂时使用固定值，后续可以从系统设置中获取）
      const defaultPassword = '123456'
      const hashedPassword = await bcrypt.hash(defaultPassword, 10)

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      )

      if (result.affectedRows === 0) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '重置密码失败',
        }
        return res.status(500).json(errorResponse)
      }

      // 记录密码重置操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'reset_user_password',
        resourceType: 'user',
        resourceId: userId,
        details: { targetUserId: userId, targetUserEmail: users[0].email },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const successResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: '密码已重置为系统默认密码' },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('重置用户密码错误:', error)
      const errorResponse: ApiResponse<{ message: string }> = {
        success: false,
        error: error instanceof Error ? error.message : '重置密码失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '无效的用户ID',
        }
        return res.status(400).json(errorResponse)
      }

      // 检查用户是否存在
      const [users] = await pool.query<IUser[]>('SELECT id, role, email FROM users WHERE id = ?', [userId])

      if (users.length === 0) {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '用户不存在',
        }
        return res.status(404).json(errorResponse)
      }

      // 保护admin账号不被删除
      if (users[0].role === 'admin') {
        const errorResponse: ApiResponse<{ message: string }> = {
          success: false,
          error: '管理员账号不允许删除',
        }
        return res.status(403).json(errorResponse)
      }

      // 开始事务，确保数据一致性
      await pool.query('START TRANSACTION')

      try {
        // 删除相关的考试结果记录
        await pool.query('DELETE FROM exam_results WHERE user_id = ?', [userId])

        // 删除相关的答题记录（通过exam_results关联）
        await pool.query(
          'DELETE FROM answer_records WHERE exam_result_id IN (SELECT id FROM exam_results WHERE user_id = ?)',
          [userId]
        )

        // 删除相关的任务记录
        await pool.query('DELETE FROM tasks WHERE user_id = ?', [userId])

        // 删除相关的通知记录
        await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId])

        // 最后删除用户
        const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId])

        if (result.affectedRows === 0) {
          await pool.query('ROLLBACK')
          const errorResponse: ApiResponse<{ message: string }> = {
            success: false,
            error: '删除用户失败',
          }
          return res.status(500).json(errorResponse)
        }

        // 提交事务
        await pool.query('COMMIT')
      } catch (deleteError) {
        // 回滚事务
        await pool.query('ROLLBACK')
        throw deleteError
      }

      // 记录用户删除操作日志
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'delete_user',
        resourceType: 'user',
        resourceId: userId,
        details: { targetUserId: userId, targetUserEmail: users[0].email },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const successResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: '用户删除成功' },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('删除用户错误:', error)
      const errorResponse: ApiResponse<{ message: string }> = {
        success: false,
        error: error instanceof Error ? error.message : '删除用户失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async getSettings(req: AuthRequest, res: Response<ApiResponse<UserSettings>>) {
    try {
      if (!req.user?.id) {
        const errorResponse: ApiResponse<UserSettings> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      // 从数据库中获取用户设置
      const [rows] = await pool.query<RowDataPacket[]>('SELECT settings FROM user_settings WHERE user_id = ?', [
        req.user.id,
      ])

      // 默认设置
      const defaultSettings: UserSettings = {
        notifications: {
          email: true,
          push: true,
          sound: true,
        },
        privacy: {
          profile_visibility: 'public',
          show_activity: true,
          show_results: true,
        },
        appearance: {
          theme: 'light',
          language: 'zh-CN',
        },
      }

      // 如果找到了用户设置，则返回它，否则返回默认设置
      let settings = defaultSettings
      if (rows.length > 0) {
        try {
          // 检查settings是否已经是对象
          if (typeof rows[0].settings === 'object' && rows[0].settings !== null) {
            settings = rows[0].settings
          } else {
            settings = JSON.parse(rows[0].settings)
          }
        } catch (parseError) {
          console.error('解析设置JSON错误:', parseError)
          // 解析失败时使用默认设置
        }
      }

      // 记录设置保存操作日志
      await LoggerService.logUserAction({
        userId: req.user.id,
        username: req.user.username,
        action: 'save_settings',
        resourceType: 'user_settings',
        resourceId: req.user.id,
        details: { settingsUpdated: Object.keys(settings) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      const successResponse: ApiResponse<UserSettings> = {
        success: true,
        data: settings,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取用户设置错误:', error)
      const errorResponse: ApiResponse<UserSettings> = {
        success: false,
        error: error instanceof Error ? error.message : '获取用户设置失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async saveSettings(req: AuthRequest, res: Response<ApiResponse<UserSettings>>) {
    try {
      if (!req.user?.id) {
        const errorResponse: ApiResponse<UserSettings> = {
          success: false,
          error: '未授权',
        }
        return res.status(401).json(errorResponse)
      }

      const settings = req.body as UserSettings

      // 将设置保存到数据库
      // 首先检查是否已经存在设置
      const [existingSettings] = await pool.query<RowDataPacket[]>('SELECT 1 FROM user_settings WHERE user_id = ?', [
        req.user.id,
      ])

      // 确保settings是JSON字符串
      let settingsJson: string
      try {
        // 如果已经是字符串，则不需要转换
        if (typeof settings === 'string') {
          // 验证是否是有效的JSON字符串
          JSON.parse(settings)
          settingsJson = settings
        } else {
          // 对象转换为JSON字符串
          settingsJson = JSON.stringify(settings)
        }
      } catch (error) {
        console.error('设置转换为JSON错误:', error)
        throw new Error('设置格式无效')
      }

      if (existingSettings.length > 0) {
        // 更新现有设置
        await pool.query('UPDATE user_settings SET settings = ? WHERE user_id = ?', [settingsJson, req.user.id])
      } else {
        // 插入新设置
        await pool.query('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)', [req.user.id, settingsJson])
      }

      console.log('保存用户设置成功:', settings)

      const successResponse: ApiResponse<UserSettings> = {
        success: true,
        data: settings,
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('保存用户设置错误:', error)
      const errorResponse: ApiResponse<UserSettings> = {
        success: false,
        error: error instanceof Error ? error.message : '保存用户设置失败',
      }
      return res.status(500).json(errorResponse)
    }
  }
}
