import { pool } from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import type { LogQueryParams, LogRow } from '../domain/log.model'

export class LogService {
  async getLogs(user: { id?: number; role?: string } | undefined, q: any) {
    const currentUserId = user?.id
    const userRole = user?.role
    if (!currentUserId) throw new Error('未授权访问')

    const { page = 1, limit = 20, level, action, username, start_date: startDate, end_date: endDate } = q || {}
    const pageNum = parseInt(String(page)) || 1
    const limitNum = parseInt(String(limit)) || 20

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
    const total = (countResult[0] as any)?.total || 0

    return { logs, total, page: pageNum, limit: limitNum }
  }

  async getUserLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    const currentUserId = user?.id
    const userRole = user?.role
    if (!currentUserId) throw new Error('未授权访问')
    if (userRole !== 'admin' && userRole !== 'teacher') throw new Error('权限不足')

    const { page = 1, limit = 20, startDate, endDate, action, userId } = q
    let whereClause = 'log_type = "user"'
    const params: any[] = []

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
      `SELECT * FROM logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?, ?`,
      [...params, offset, limit]
    )
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM logs WHERE ${whereClause}`,
      params
    )

    return { logs, total: (countResult[0] as any).total as number, page, limit }
  }

  async getSystemLogs(userRole: string | undefined, q: LogQueryParams) {
    if (userRole !== 'admin') throw new Error('权限不足')
    const { page = 1, limit = 20, startDate, endDate, level, module } = q

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

    return { logs, total: (countResult[0] as any).total as number, page, limit }
  }

  async getAuditLogs(userRole: string | undefined, q: LogQueryParams) {
    if (userRole !== 'admin') throw new Error('权限不足')
    const { page = 1, limit = 20, startDate, endDate, action, userId } = q

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
      `SELECT * FROM logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?, ?`,
      [...params, offset, limit]
    )
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM logs WHERE ${whereClause}`,
      params
    )

    return { logs, total: (countResult[0] as any).total as number, page, limit }
  }

  async getLoginLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    const currentUserId = user?.id
    const userRole = user?.role
    if (!currentUserId) throw new Error('未授权访问')

    const { page = 1, limit = 20, startDate, endDate, userId } = q

    let whereClause = 'log_type = "login"'
    const params: any[] = []

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

    return { logs, total: (countResult[0] as any).total as number, page, limit }
  }

  async getExamLogs(user: { id?: number; role?: string } | undefined, examId: number, q: LogQueryParams) {
    const currentUserId = user?.id
    const userRole = user?.role
    if (!currentUserId) throw new Error('未授权访问')

    const { page = 1, limit = 20, startDate, endDate, action, userId } = q
    let whereClause = 'el.exam_id = ?'
    const params: any[] = [examId]

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

    return { logs, total: (countResult[0] as any).total as number, page, limit }
  }

  async cleanupLogs(userRole: string | undefined, daysToKeep: number) {
    if (userRole !== 'admin') throw new Error('权限不足')
    if (Number.isNaN(daysToKeep) || daysToKeep < 0) throw new Error('daysToKeep 必须为非负数字')
    await pool.query('DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [daysToKeep])
    return { message: '日志清理完成' }
  }

  async exportLogs(user: { id?: number; role?: string } | undefined, q: any) {
    const currentUserId = user?.id
    const userRole = user?.role
    if (!currentUserId) throw new Error('未授权访问')

    const { level, action, username, start_date: startDate, end_date: endDate } = q || {}

    let query = `
      SELECT id, log_type, level, user_id, username, action, 
             resource_type as resource, message, details, 
             ip_address, user_agent, status, created_at
      FROM logs 
      WHERE 1=1
    `
    const params: any[] = []

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
    return rows
  }
}
