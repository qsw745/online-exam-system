// apps/backend/src/modules/analytics/controllers/log.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from 'types/auth'
import type { ApiResponse } from 'types/response'
import type { LogQueryParams } from '../domain/log.model'
import { LogService } from '../services/log.service'

const service = new LogService()

const pickUser = (u: AuthRequest['user']) =>
  u ? ({ id: u.id, role: u.role || undefined } as { id?: number; role?: string }) : undefined

export class LogController {
  static async getLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLogs(pickUser(req.user), req.query)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '获取日志失败'
      console.error('[log] 获取日志失败:', error)
      return res
        .status(msg === '未授权访问' ? 401 : msg === '权限不足' ? 403 : 500)
        .json({ success: false, error: msg })
    }
  }

  static async getUserLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getUserLogs(pickUser(req.user), req.query as LogQueryParams)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '获取用户日志失败'
      console.error('[log] 获取用户日志失败:', error)
      return res
        .status(msg === '未授权访问' ? 401 : msg === '权限不足' ? 403 : 500)
        .json({ success: false, error: msg })
    }
  }

  static async getSystemLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getSystemLogs(req.user?.role || undefined, req.query as LogQueryParams)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '获取系统日志失败'
      console.error('[log] 获取系统日志失败:', error)
      return res.status(msg === '权限不足' ? 403 : 500).json({ success: false, error: msg })
    }
  }

  static async getAuditLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getAuditLogs(req.user?.role || undefined, req.query as LogQueryParams)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '获取审计日志失败'
      console.error('[log] 获取审计日志失败:', error)
      return res.status(msg === '权限不足' ? 403 : 500).json({ success: false, error: msg })
    }
  }

  static async getLoginLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLoginLogs(pickUser(req.user), req.query as LogQueryParams)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '获取登录日志失败'
      console.error('[log] 获取登录日志失败:', error)
      return res.status(msg === '未授权访问' ? 401 : 500).json({ success: false, error: msg })
    }
  }

  static async getExamLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const examId = Number(req.params.examId)
      const data = await service.getExamLogs(pickUser(req.user), examId, req.query as LogQueryParams)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '获取考试日志失败'
      console.error('[log] 获取考试日志失败:', error)
      return res
        .status(msg === '未授权访问' ? 401 : msg === '权限不足' ? 403 : 500)
        .json({ success: false, error: msg })
    }
  }

  static async cleanupLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const daysToKeep = Number((req.body as any)?.daysToKeep ?? 90)
      const data = await service.cleanupLogs(req.user?.role || undefined, daysToKeep)
      return res.json({ success: true, data })
    } catch (error: any) {
      const msg = error?.message || '清理日志失败'
      console.error('[log] 清理日志失败:', error)
      return res.status(msg === '权限不足' ? 403 : 500).json({ success: false, error: msg })
    }
  }

  static async exportLogs(req: AuthRequest, res: Response) {
    try {
      const rows = await service.exportLogs(pickUser(req.user), req.query)
      const fmt = (req.query as any)?.format || 'csv'
      if (fmt === 'csv') {
        const header = 'ID,类型,级别,时间,用户,操作,资源,消息,详情,IP地址,状态\n'
        const csv = rows
          .map((log: any) => {
            const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details ?? '')
            const message = typeof log.message === 'string' ? log.message : JSON.stringify(log.message ?? '')
            const resource = log.resource ?? log.resource_type ?? ''
            return `${log.id},${log.log_type},${log.level ?? ''},${log.created_at},${log.username ?? ''},${
              log.action ?? ''
            },${resource},"${message.replace(/"/g, '""')}","${details.replace(/"/g, '""')}",${log.ip_address ?? ''},${
              log.status ?? ''
            }`
          })
          .join('\n')
        res.header('Content-Type', 'text/csv; charset=utf-8')
        res.header('Content-Disposition', `attachment; filename=logs_${new Date().toISOString().split('T')[0]}.csv`)
        return res.send('\uFEFF' + header + csv)
      }
      res.header('Content-Type', 'application/json; charset=utf-8')
      res.header('Content-Disposition', `attachment; filename=logs_${new Date().toISOString().split('T')[0]}.json`)
      return res.json(rows)
    } catch (error: any) {
      const msg = error?.message || '导出日志失败'
      console.error('[log] 导出日志失败:', error)
      return res.status(msg === '未授权访问' ? 401 : 500).json({ success: false, error: msg })
    }
  }
}
