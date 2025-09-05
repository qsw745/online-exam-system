import { pool } from '@config/database.js'
import { LoggerService } from '../../services/logger.service.js'

import bcrypt from 'bcryptjs'
import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

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
        'SELECT id, username, email, role, nickname, status, school, class_name, experience_points, level, avatar_url, created_at, updated_at FROM users WHERE id = ?',
        [parseInt(id)]
      )

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: '用户不存在' })
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

      const userData: UserData = {
        ...users[0],
        statistics: {
          totalSubmissions: stats[0]?.totalSubmissions || 0,
          completedSubmissions: stats[0]?.completedSubmissions || 0,
          averageScore: stats[0]?.averageScore || 0,
        },
      }

      return res.json({ success: true, data: userData })
    } catch (error) {
      console.error('获取用户详情错误:', error)
      return res.status(500).json({ success: false, error: '获取用户详情失败' })
    }
  }

  static async getCurrentUser(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '未授权' })
      }

      const [users] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, status, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      )

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      return res.json({ success: true, data: users[0] })
    } catch (error) {
      console.error('获取当前用户信息错误:', error)
      return res.status(500).json({ success: false, error: '获取用户信息失败' })
    }
  }

  static async updateCurrentUser(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '未授权' })
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
        return res.status(400).json({ success: false, error: '没有提供要更新的字段' })
      }

      values.push(req.user.id)
      await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)

      const [updatedUsers] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, status, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      )

      // 行为日志：资料更新
      await LoggerService.logUserAction({
        userId: req.user.id,
        username: req.user.username,
        action: 'update_profile',
        resourceType: 'user',
        resourceId: Number(req.user.id),
        details: { updatedFields: ['nickname', 'school', 'class_name'].filter(f => req.body[f] !== undefined) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: updatedUsers[0] })
    } catch (error) {
      console.error('更新当前用户信息错误:', error)
      return res.status(500).json({ success: false, error: '更新用户信息失败' })
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '未授权' })
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: '没有提供头像文件' })
      }

      // 使用完整的URL路径，确保前端可以正确访问
      const baseUrl = process.env.PUBLIC_URL || process.env.API_URL || 'http://localhost:3000'
      const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`

      await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [avatarUrl, req.user.id])

      const [updatedUsers] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, school, class_name, experience_points, level, avatar_url, created_at, updated_at FROM users WHERE id = ?',
        [req.user.id]
      )

      // 行为日志：上传头像
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

      return res.json({ success: true, data: updatedUsers[0] })
    } catch (error) {
      console.error('上传头像错误:', error)
      return res.status(500).json({ success: false, error: '上传头像失败' })
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

      return res.json({
        success: true,
        data: {
          users,
          total: totalRows[0].total,
          page,
          limit,
        },
      })
    } catch (error) {
      console.error('获取用户列表错误:', error)
      return res.status(500).json({ success: false, error: '获取用户列表失败' })
    }
  }

  static async update(req: AuthRequest, res: Response<ApiResponse<UserData>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: '无效的用户ID' })
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
        return res.status(400).json({ success: false, error: '没有提供要更新的字段' })
      }

      values.push(userId)
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      )

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: '用户不存在' })
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

      return res.json({ success: true, data: updatedUser[0] })
    } catch (error) {
      console.error('更新用户信息错误:', error)
      return res.status(500).json({ success: false, error: '更新用户信息失败' })
    }
  }

  static async updateStatus(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: '无效的用户ID' })
      }

      const { status } = req.body
      if (!status || !['active', 'disabled'].includes(status)) {
        return res.status(400).json({ success: false, error: '无效的状态值' })
      }

      // 检查用户是否存在
      const [users] = await pool.query<IUser[]>('SELECT id, role FROM users WHERE id = ?', [userId])

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      // 保护admin账号不被禁用
      if (users[0].role === 'admin' && status === 'disabled') {
        return res.status(403).json({ success: false, error: '管理员账号不允许禁用' })
      }

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, userId]
      )

      if (result.affectedRows === 0) {
        return res.status(500).json({ success: false, error: '更新用户状态失败' })
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

      return res.json({ success: true, data: { message: `用户状态已更新为${status === 'active' ? '启用' : '禁用'}` } })
    } catch (error) {
      console.error('更新用户状态错误:', error)
      return res.status(500).json({ success: false, error: '更新用户状态失败' })
    }
  }

  static async resetPassword(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: '无效的用户ID' })
      }

      // 检查用户是否存在
      const [users] = await pool.query<IUser[]>('SELECT id, email FROM users WHERE id = ?', [userId])

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      // 获取系统默认密码（这里暂时使用固定值，后续可以从系统设置中获取）
      const defaultPassword = '123456'
      const hashedPassword = await bcrypt.hash(defaultPassword, 10)

      const [result] = await pool.query<ResultSetHeader>(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      )

      if (result.affectedRows === 0) {
        return res.status(500).json({ success: false, error: '重置密码失败' })
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

      return res.json({ success: true, data: { message: '密码已重置为系统默认密码' } })
    } catch (error) {
      console.error('重置用户密码错误:', error)
      return res.status(500).json({ success: false, error: '重置密码失败' })
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: '无效的用户ID' })
      }

      // 检查用户是否存在
      const [users] = await pool.query<IUser[]>('SELECT id, role, email FROM users WHERE id = ?', [userId])

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      // 保护admin账号不被删除
      if (users[0].role === 'admin') {
        return res.status(403).json({ success: false, error: '管理员账号不允许删除' })
      }

      // 开始事务，确保数据一致性
      await pool.query('START TRANSACTION')

      try {
        // 先删子表（答题记录），再删父表（考试结果）
        await pool.query(
          'DELETE FROM answer_records WHERE exam_result_id IN (SELECT id FROM exam_results WHERE user_id = ?)',
          [userId]
        )
        await pool.query('DELETE FROM exam_results WHERE user_id = ?', [userId])

        // 其它关联数据
        await pool.query('DELETE FROM tasks WHERE user_id = ?', [userId])
        await pool.query('DELETE FROM notifications WHERE user_id = ?', [userId])

        // 最后删除用户
        const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId])

        if (result.affectedRows === 0) {
          await pool.query('ROLLBACK')
          return res.status(500).json({ success: false, error: '删除用户失败' })
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

      return res.json({ success: true, data: { message: '用户删除成功' } })
    } catch (error) {
      console.error('删除用户错误:', error)
      return res.status(500).json({ success: false, error: '删除用户失败' })
    }
  }

  static async getSettings(req: AuthRequest, res: Response<ApiResponse<UserSettings>>) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '未授权' })
      }

      // 从数据库中获取用户设置
      const [rows] = await pool.query<RowDataPacket[]>('SELECT settings FROM user_settings WHERE user_id = ?', [
        req.user.id,
      ])

      // 默认设置
      const defaultSettings: UserSettings = {
        notifications: { email: true, push: true, sound: true },
        privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
        appearance: { theme: 'light', language: 'zh-CN' },
      }

      // 如果找到了用户设置，则返回它，否则返回默认设置
      let settings = defaultSettings
      if (rows.length > 0) {
        try {
          // 检查settings是否已经是对象
          if (typeof rows[0].settings === 'object' && rows[0].settings !== null) {
            settings = rows[0].settings as any
          } else {
            settings = JSON.parse(rows[0].settings as any)
          }
        } catch (parseError) {
          console.error('解析设置JSON错误:', parseError)
          // 解析失败时使用默认设置
        }
      }

      // 读取设置日志
      await LoggerService.logUserAction({
        userId: req.user.id,
        username: req.user.username,
        action: 'read_settings',
        resourceType: 'user_settings',
        resourceId: req.user.id,
        details: { keys: Object.keys(settings || {}) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: settings })
    } catch (error) {
      console.error('获取用户设置错误:', error)
      return res.status(500).json({ success: false, error: '获取用户设置失败' })
    }
  }

  static async saveSettings(req: AuthRequest, res: Response<ApiResponse<UserSettings>>) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '未授权' })
      }

      const settings = req.body as UserSettings

      // 将设置保存到数据库
      const [existingSettings] = await pool.query<RowDataPacket[]>('SELECT 1 FROM user_settings WHERE user_id = ?', [
        req.user.id,
      ])

      // JSON 序列化
      let settingsJson: string
      try {
        settingsJson = typeof settings === 'string' ? (JSON.parse(settings), settings) : JSON.stringify(settings)
      } catch (error) {
        console.error('设置转换为JSON错误:', error)
        return res.status(400).json({ success: false, error: '设置格式无效' })
      }

      if (existingSettings.length > 0) {
        await pool.query('UPDATE user_settings SET settings = ? WHERE user_id = ?', [settingsJson, req.user.id])
      } else {
        await pool.query('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)', [req.user.id, settingsJson])
      }

      // 保存设置日志
      await LoggerService.logUserAction({
        userId: req.user.id,
        username: req.user.username,
        action: 'save_settings',
        resourceType: 'user_settings',
        resourceId: req.user.id,
        details: { keys: Object.keys((typeof settings === 'string' ? JSON.parse(settings) : settings) || {}) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: typeof settings === 'string' ? JSON.parse(settings) : settings })
    } catch (error) {
      console.error('保存用户设置错误:', error)
      return res.status(500).json({ success: false, error: '保存用户设置失败' })
    }
  }
}
