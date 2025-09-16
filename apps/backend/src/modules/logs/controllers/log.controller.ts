// apps/backend/src/modules/logs/controllers/log.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { LogQueryParams } from '../domain/log.model'
import { LogService } from '../services/log.service'

const service = new LogService()

const pickUser = (u: AuthRequest['user']) =>
    u ? ({ id: u.id, role: (u as any).role || (u as any).roles?.[0] || undefined } as { id?: number; role?: string }) : undefined

/** 统一错误应答：把常见文案映射到 401/403，否则 500 */
function respondError(res: Response, error: any, fallbackMsg: string) {
  const msg = (error?.message && String(error.message)) || fallbackMsg
  if (/未授权访问|unauthorized/i.test(msg)) {
    return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
  }
  if (/权限不足|forbidden|没有权限/i.test(msg)) {
    return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
  }
  // 其他 -> 500
  return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
}

export class LogController {
  static async getLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLogs(pickUser(req.user), req.query as any)
      return (res as any).ok(data, '获取日志成功')
    } catch (error: any) {
      console.error('[log] 获取日志失败:', error)
      return respondError(res, error, '获取日志失败')
    }
  }

  static async getUserLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLogs(pickUser(req.user), req.query as any)
      return (res as any).ok(data, '获取用户日志成功')
    } catch (error: any) {
      console.error('[log] 获取用户日志失败:', error)
      return respondError(res, error, '获取用户日志失败')
    }
  }

  static async getSystemLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getSystemLogs((req.user as any)?.role || undefined, req.query as LogQueryParams)
      return (res as any).ok(data, '获取系统日志成功')
    } catch (error: any) {
      console.error('[log] 获取系统日志失败:', error)
      return respondError(res, error, '获取系统日志失败')
    }
  }

  static async getAuditLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getAuditLogs((req.user as any)?.role || undefined, req.query as LogQueryParams)
      return (res as any).ok(data, '获取审计日志成功')
    } catch (error: any) {
      console.error('[log] 获取审计日志失败:', error)
      return respondError(res, error, '获取审计日志失败')
    }
  }

  static async getLoginLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLoginLogs(pickUser(req.user), req.query as LogQueryParams)
      return (res as any).ok(data, '获取登录日志成功')
    } catch (error: any) {
      console.error('[log] 获取登录日志失败:', error)
      return respondError(res, error, '获取登录日志失败')
    }
  }

  /** ✅ 需要 service.getExamLogs 已实现 */
  static async getExamLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const examId = Number(req.params.examId)
      const data = await service.getExamLogs(pickUser(req.user), examId, req.query as LogQueryParams)
      return (res as any).ok(data, '获取考试日志成功')
    } catch (error: any) {
      console.error('[log] 获取考试日志失败:', error)
      return respondError(res, error, '获取考试日志失败')
    }
  }

  static async cleanupLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const daysToKeep = Number((req.body as any)?.daysToKeep ?? 90)
      const data = await service.cleanupLogs((req.user as any)?.role || undefined, daysToKeep)
      return (res as any).ok(data, '清理日志成功')
    } catch (error: any) {
      console.error('[log] 清理日志失败:', error)
      return respondError(res, error, '清理日志失败')
    }
  }

  /** 导出是文件下载场景，保持原始输出；失败时用统一 fail */
  static async exportLogs(req: AuthRequest, res: Response) {
    try {
      const rows = await service.exportLogs(pickUser(req.user), req.query as any)
      const fmt = (req.query as any)?.format || 'csv'
      if (fmt === 'csv') {
        const header = 'ID,类型,级别,时间,用户,操作,资源,客户端,User-Agent,消息,详情,IP地址,状态\n'
        const csv = rows
            .map((log: any) => {
              const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details ?? '')
              const message = typeof log.message === 'string' ? log.message : JSON.stringify(log.message ?? '')
              const resource = log.resource_type ?? ''
              const client = log.client?.label || ''
              const ua = log.user_agent || ''
              return [
                log.id,
                log.log_type,
                log.level ?? '',
                log.created_at,
                log.username ?? '',
                log.action ?? '',
                resource,
                client,
                ua.replace(/"/g, '""'),
                message.replace(/"/g, '""'),
                details.replace(/"/g, '""'),
                log.ip_address ?? '',
                log.status ?? '',
              ]
                  .map(v => (typeof v === 'string' ? `"${v}"` : v))
                  .join(',')
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
      console.error('[log] 导出日志失败:', error)
      return (res as any).fail(CODES.INTERNAL_ERROR, 500, error?.message || '导出日志失败')
    }
  }
}
