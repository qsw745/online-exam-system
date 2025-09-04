import { Response } from 'express'
import { RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import { AuthRequest } from 'types/auth.js'
import { ApiResponse } from 'types/response.js'

interface LogQueryParams {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  level?: string
  module?: string
  action?: string
  userId?: number
}

/** 结合本文件查询中会用到的字段，给出明确的行类型 */
interface LogRow extends RowDataPacket {
  id: number
  log_type: string
  level: string | null
  user_id: number | null
  username: string | null
  action: string | null
  resource_type?: string | null
  resource?: string | null
  message: string | null
  details: string | null
  ip_address: string | null
  user_agent?: string | null
  status: string | null
  created_at: string // DATETIME/TIMESTAMP as string
}

export class LogController {
  // 获取日志（通用接口 - 统一日志表）
  static async getLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const currentUserId = req.user?.id
      const userRole = req.user?.role

      if (!currentUserId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }

      const {
        page = 1,
        limit = 20,
        level,
        action,
        username,
        start_date: startDate,
        end_date: endDate,
      } = req.query as any

      const pageNum = parseInt(page as string) || 1
      const limitNum = parseInt(limit as string) || 20

      // 使用统一的logs表
      let query = `
        SELECT id, log_type, level, user_id, username, action, 
               resource_type as resource, message, details, 
               ip_address, user_agent, status, created_at
        FROM logs 
        WHERE 1=1
      `
      let countQuery = 'SELECT COUNT(*) as total FROM logs WHERE 1=1'
      const params: any[] = []
      const countParams: any[] = []

      // 非管理员只能查看自己的日志（允许查看 system、自己的 login）
      if (userRole !== 'admin') {
        query += ' AND (user_id = ? OR log_type = "system" OR (log_type = "login" AND user_id = ?))'
        countQuery += ' AND (user_id = ? OR log_type = "system" OR (log_type = "login" AND user_id = ?))'
        params.push(currentUserId, currentUserId)
        countParams.push(currentUserId, currentUserId)
      }

      if (level && level !== 'all') {
        query += ' AND level = ?'
        countQuery += ' AND level = ?'
        params.push(level)
        countParams.push(level)
      }

      if (username) {
        query += ' AND username LIKE ?'
        countQuery += ' AND username LIKE ?'
        params.push(`%${username}%`)
        countParams.push(`%${username}%`)
      }

      if (action) {
        query += ' AND action LIKE ?'
        countQuery += ' AND action LIKE ?'
        params.push(`%${action}%`)
        countParams.push(`%${action}%`)
      }

      if (startDate) {
        query += ' AND created_at >= ?'
        countQuery += ' AND created_at >= ?'
        params.push(startDate)
        countParams.push(startDate)
      }

      if (endDate) {
        query += ' AND created_at <= ?'
        countQuery += ' AND created_at <= ?'
        params.push(endDate)
        countParams.push(endDate)
      }

      const offset = (pageNum - 1) * limitNum
      query += ' ORDER BY created_at DESC LIMIT ?, ?'
      params.push(offset, limitNum)

      const [logs] = await pool.query<RowDataPacket[]>(query, params)
      const [countResult] = await pool.query<RowDataPacket[]>(countQuery, countParams)

      return res.json({
        success: true,
        data: {
          logs,
          total: (countResult[0] as RowDataPacket & { total: number }).total,
          page: pageNum,
          limit: limitNum,
        },
      })
    } catch (error) {
      console.error('[log] 获取日志失败:', error)
      return res.status(500).json({ success: false, error: '获取日志失败' })
    }
  }

  // 获取用户操作日志（统一日志表）
  static async getUserLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const currentUserId = req.user?.id
      const userRole = req.user?.role

      if (!currentUserId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }

      // 检查权限：管理员/教师可以查看所有日志，普通用户只能查看自己的日志
      if (userRole !== 'admin' && userRole !== 'teacher') {
        return res.status(403).json({ success: false, error: '权限不足' })
      }

      const { page = 1, limit = 20, startDate, endDate, action, userId } = req.query as LogQueryParams

      let whereClause = 'log_type = "user"'
      const params: any[] = []

      // 非管理员只能查看自己的日志
      if (userRole !== 'admin') {
        whereClause += ' AND user_id = ?'
        params.push(currentUserId)
      } else if (userId) {
        whereClause += ' AND user_id = ?'
        params.push(userId)
      }

      if (startDate) {
        whereClause += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?'
        params.push(endDate)
      }

      if (action) {
        whereClause += ' AND action = ?'
        params.push(action)
      }

      const offset = (page - 1) * limit

      const [logs] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM logs 
         WHERE ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ?, ?`,
        [...params, offset, limit]
      )

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM logs WHERE ${whereClause}`,
        params
      )

      return res.json({
        success: true,
        data: {
          logs,
          total: (countResult[0] as any).total as number,
          page,
          limit,
        },
      })
    } catch (error) {
      console.error('[log] 获取用户日志失败:', error)
      return res.status(500).json({ success: false, error: '获取用户日志失败' })
    }
  }

  // 获取系统日志（统一日志表）
  static async getSystemLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userRole = req.user?.role

      if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: '权限不足' })
      }

      const { page = 1, limit = 20, startDate, endDate, level, module } = req.query as LogQueryParams

      let whereClause = 'log_type = "system"'
      const params: any[] = []

      if (startDate) {
        whereClause += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?'
        params.push(endDate)
      }

      if (level) {
        whereClause += ' AND level = ?'
        params.push(level)
      }

      if (module) {
        whereClause += ' AND resource_type = ?'
        params.push(module)
      }

      const offset = (page - 1) * limit

      const [logs] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?, ?`,
        [...params, offset, limit]
      )

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM logs WHERE ${whereClause}`,
        params
      )

      return res.json({
        success: true,
        data: {
          logs,
          total: (countResult[0] as any).total as number,
          page,
          limit,
        },
      })
    } catch (error) {
      console.error('[log] 获取系统日志失败:', error)
      return res.status(500).json({ success: false, error: '获取系统日志失败' })
    }
  }

  // 获取审计日志（统一日志表）
  static async getAuditLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userRole = req.user?.role

      if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: '权限不足' })
      }

      const { page = 1, limit = 20, startDate, endDate, action, userId } = req.query as LogQueryParams

      let whereClause = 'log_type = "audit"'
      const params: any[] = []

      if (startDate) {
        whereClause += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?'
        params.push(endDate)
      }

      if (action) {
        whereClause += ' AND action = ?'
        params.push(action)
      }

      if (userId) {
        whereClause += ' AND user_id = ?'
        params.push(userId)
      }

      const offset = (page - 1) * limit

      const [logs] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM logs 
         WHERE ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ?, ?`,
        [...params, offset, limit]
      )

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM logs WHERE ${whereClause}`,
        params
      )

      return res.json({
        success: true,
        data: {
          logs,
          total: (countResult[0] as any).total as number,
          page,
          limit,
        },
      })
    } catch (error) {
      console.error('[log] 获取审计日志失败:', error)
      return res.status(500).json({ success: false, error: '获取审计日志失败' })
    }
  }

  // 获取登录日志（统一日志表）
  static async getLoginLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const currentUserId = req.user?.id
      const userRole = req.user?.role

      if (!currentUserId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }

      const { page = 1, limit = 20, startDate, endDate, userId } = req.query as LogQueryParams

      let whereClause = 'log_type = "login"'
      const params: any[] = []

      // 非管理员只能查看自己的登录日志
      if (userRole !== 'admin') {
        whereClause += ' AND user_id = ?'
        params.push(currentUserId)
      } else if (userId) {
        whereClause += ' AND user_id = ?'
        params.push(userId)
      }

      if (startDate) {
        whereClause += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?'
        params.push(endDate)
      }

      const offset = (page - 1) * limit

      const [logs] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?, ?`,
        [...params, offset, limit]
      )

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM logs WHERE ${whereClause}`,
        params
      )

      return res.json({
        success: true,
        data: {
          logs,
          total: (countResult[0] as any).total as number,
          page,
          limit,
        },
      })
    } catch (error) {
      console.error('[log] 获取登录日志失败:', error)
      return res.status(500).json({ success: false, error: '获取登录日志失败' })
    }
  }

  // 获取考试日志
  static async getExamLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const currentUserId = req.user?.id
      const userRole = req.user?.role

      if (!currentUserId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }

      const { page = 1, limit = 20, startDate, endDate, action, userId } = req.query as LogQueryParams
      const examId = parseInt(req.params.examId, 10)

      let whereClause = 'el.exam_id = ?'
      const params: any[] = [examId]

      // 非管理员/教师只能查看自己的考试日志
      if (userRole !== 'admin' && userRole !== 'teacher') {
        whereClause += ' AND el.user_id = ?'
        params.push(currentUserId)
      } else if (userId) {
        whereClause += ' AND el.user_id = ?'
        params.push(userId)
      }

      if (startDate) {
        whereClause += ' AND el.created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        whereClause += ' AND el.created_at <= ?'
        params.push(endDate)
      }

      if (action) {
        whereClause += ' AND el.action = ?'
        params.push(action)
      }

      const offset = (page - 1) * limit

      const [logs] = await pool.query<RowDataPacket[]>(
        `SELECT el.*, u.username, q.content as question_content 
         FROM exam_logs el 
         LEFT JOIN users u ON el.user_id = u.id 
         LEFT JOIN questions q ON el.question_id = q.id 
         WHERE ${whereClause} 
         ORDER BY el.created_at DESC 
         LIMIT ?, ?`,
        [...params, offset, limit]
      )

      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM exam_logs el WHERE ${whereClause}`,
        params
      )

      return res.json({
        success: true,
        data: {
          logs,
          total: (countResult[0] as any).total as number,
          page,
          limit,
        },
      })
    } catch (error) {
      console.error('[log] 获取考试日志失败:', error)
      return res.status(500).json({ success: false, error: '获取考试日志失败' })
    }
  }

  // 清理过期日志（直接 SQL 删除早于 N 天的数据）
  static async cleanupLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userRole = req.user?.role

      if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: '权限不足' })
      }

      const { daysToKeep = 90 } = req.body as { daysToKeep?: number }

      if (typeof daysToKeep !== 'number' || Number.isNaN(daysToKeep) || daysToKeep < 0) {
        return res.status(400).json({ success: false, error: 'daysToKeep 必须为非负数字' })
      }

      await pool.query('DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [daysToKeep])

      return res.json({
        success: true,
        data: { message: '日志清理完成' },
      })
    } catch (error) {
      console.error('[log] 清理日志失败:', error)
      return res.status(500).json({ success: false, error: '清理日志失败' })
    }
  }

  // 导出日志（统一日志表）
  static async exportLogs(req: AuthRequest, res: Response) {
    try {
      const currentUserId = req.user?.id
      const userRole = req.user?.role

      if (!currentUserId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }

      const { level, action, username, start_date: startDate, end_date: endDate, format = 'csv' } = req.query as any

      // 使用统一的logs表
      let query = `
        SELECT id, log_type, level, user_id, username, action, 
               resource_type as resource, message, details, 
               ip_address, user_agent, status, created_at
        FROM logs 
        WHERE 1=1
      `
      const params: any[] = []

      // 非管理员只能导出自己的日志（允许 system）
      if (userRole !== 'admin') {
        query += ' AND (user_id = ? OR log_type = "system")'
        params.push(currentUserId)
      }

      if (level && level !== 'all') {
        query += ' AND level = ?'
        params.push(level)
      }

      if (username) {
        query += ' AND username LIKE ?'
        params.push(`%${username}%`)
      }

      if (action) {
        query += ' AND action LIKE ?'
        params.push(`%${action}%`)
      }

      if (startDate) {
        query += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        query += ' AND created_at <= ?'
        params.push(endDate)
      }

      query += ' ORDER BY created_at DESC'

      const [rows] = await pool.query<LogRow[]>(query, params)

      if (format === 'csv') {
        // 生成CSV格式
        const csvHeader = 'ID,类型,级别,时间,用户,操作,资源,消息,详情,IP地址,状态\n'
        const csvData = rows
          .map((log: LogRow) => {
            const details = typeof log.details === 'string' ? log.details : JSON.stringify((log as any).details ?? '')
            const message = typeof log.message === 'string' ? log.message : JSON.stringify((log as any).message ?? '')
            const resource = (log.resource ?? (log as any).resource_type ?? '') as string
            return `${log.id},${log.log_type},${log.level ?? ''},${log.created_at},${log.username ?? ''},${
              log.action ?? ''
            },${resource},"${message.replace(/"/g, '""')}","${details.replace(/"/g, '""')}",${log.ip_address ?? ''},${
              log.status ?? ''
            }`
          })
          .join('\n')

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=logs_${new Date().toISOString().split('T')[0]}.csv`)
        return res.send('\uFEFF' + csvHeader + csvData) // 添加BOM以支持中文
      } else {
        // 返回JSON格式
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=logs_${new Date().toISOString().split('T')[0]}.json`)
        return res.json(rows)
      }
    } catch (error) {
      console.error('[log] 导出日志失败:', error)
      return res.status(500).json({ success: false, error: '导出日志失败' })
    }
  }
}
