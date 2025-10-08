// apps/backend/src/modules/logs/controllers/log.controller.ts
import { SessionStore } from '@/common/session/session.store'
import { log } from '@/infrastructure/logging/logger'
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import type { LogQueryParams } from '../domain/log.model'
import { LogService } from '../services/log.service'
import { TokenRepository } from '@/modules/auth/repositories/token.repository'
import Geo from '@/common/utils/geo'

const service = new LogService()

const pickUser = (u: AuthRequest['user']) =>
  u
    ? ({ id: u.id, role: (u as any).role || (u as any).roles?.[0] || undefined } as { id?: number; role?: string })
    : undefined

function respondError(res: Response, error: any, fallbackMsg: string) {
  const msg = (error?.message && String(error.message)) || fallbackMsg
  if (/未授权访问|unauthorized/i.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
  if (/权限不足|forbidden|没有权限/i.test(msg)) return (res as any).forbidden(msg, { code: CODES.AUTH_FORBIDDEN })
  return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
}

function parseUA(uaRaw: string | null | undefined) {
  const ua = uaRaw || ''
  const os = /Windows NT 11/.test(ua)
    ? 'Windows 11'
    : /Windows NT 10/.test(ua)
    ? 'Windows 10'
    : /Macintosh|Mac OS X/.test(ua)
    ? 'macOS'
    : /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : 'Unknown'
  const browser = /Edg\/\d+/.test(ua)
    ? 'Edge'
    : /Chrome\/\d+/.test(ua) && !/Edg\/\d+/.test(ua)
    ? 'Chrome'
    : /Safari\/\d+/.test(ua) && /Version\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua)
    ? 'Safari'
    : /Firefox\/\d+/.test(ua)
    ? 'Firefox'
    : /MSIE|Trident\//.test(ua)
    ? 'IE'
    : 'Unknown'
  return { os, browser }
}

export class LogController {
  /** 在线用户（SessionStore 实时） */
  static async getOnlineUsers(_req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const rows = await SessionStore.listActive()
      const items = await Promise.all(
        rows.map(async r => {
          const { os, browser } = parseUA(r.ua)
          const geo = await Geo.lookup(r.ip || undefined)
          return {
            id: r.jti,
            session_id: r.jti,
            username: r.username,
            ip_address: r.ip || undefined,
            login_time: r.loginAt,
            os,
            browser,
            location: geo.label,
            geo,
            country: geo.country,
            region: geo.region,
            city: geo.city,
          }
        })
      )
      return (res as any).ok({ items }, '获取在线用户成功')
    } catch (error: any) {
      log.error('[log] 获取在线用户失败:', error)
      return respondError(res, error, '获取在线用户失败')
    }
  }

  /** 强退：撤销会话 + 吊销 refresh + 记日志 */
  static async kickOnlineUser(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const jti = String((req.body as any)?.id ?? (req.params as any)?.id ?? '')
      if (!jti) return (res as any).fail(CODES.VALIDATION_ERROR, 400, '缺少会话ID')
      await SessionStore.revoke(jti)
      await TokenRepository.revokeByJti(jti)
      await LogService.log(
        {
          type: 'login',
          level: 'info',
          status: 'success',
          userId: (req.user as any)?.id,
          username: (req.user as any)?.username || 'admin',
          action: 'force_logout',
          message: `管理员强退会话 ${jti.slice(0, 8)}…`,
          resourceType: 'session',
          resourceId: 0,
        },
        req as any
      )
      return (res as any).ok({ id: jti }, '强退成功')
    } catch (error: any) {
      log.error('[log] 强退失败:', error)
      return respondError(res, error, '强退失败')
    }
  }

  static async getLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLogs(pickUser(req.user), req.query as any)
      return (res as any).ok(data, '获取日志成功')
    } catch (error: any) {
      log.error('[log] 获取日志失败:', error)
      return respondError(res, error, '获取日志失败')
    }
  }

  static async getUserLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLogs(pickUser(req.user), req.query as any)
      return (res as any).ok(data, '获取用户日志成功')
    } catch (error: any) {
      log.error('[log] 获取用户日志失败:', error)
      return respondError(res, error, '获取用户日志失败')
    }
  }

  static async getSystemLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getSystemLogs((req.user as any)?.role || undefined, req.query as LogQueryParams)
      return (res as any).ok(data, '获取系统日志成功')
    } catch (error: any) {
      log.error('[log] 获取系统日志失败:', error)
      return respondError(res, error, '获取系统日志失败')
    }
  }

  static async getAuditLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const current = pickUser(req.user) // { id?: number; role?: string }
      const role = current?.role
      const q = { ...(req.query as any) }

      // 确保是“审计/安全类”日志；若前端未显式传 type，则默认限定为 audit
      if (!q.type) q.type = 'audit'

      const data = await service.getAuditLogs(current, q)
      return (res as any).ok(data, '获取审计日志成功')
    } catch (error: any) {
      log.error('[log] 获取审计日志失败:', error)
      return respondError(res, error, '获取审计日志失败')
    }
  }

  static async getLoginLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const data = await service.getLoginLogs(pickUser(req.user), req.query as LogQueryParams)
      return (res as any).ok(data, '获取登录日志成功')
    } catch (error: any) {
      log.error('[log] 获取登录日志失败:', error)
      return respondError(res, error, '获取登录日志失败')
    }
  }

  static async getExamLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const examId = Number(req.params.examId)
      const data = await service.getExamLogs(pickUser(req.user), examId, req.query as LogQueryParams)
      return (res as any).ok(data, '获取考试日志成功')
    } catch (error: any) {
      log.error('[log] 获取考试日志失败:', error)
      return respondError(res, error, '获取考试日志失败')
    }
  }

  static async cleanupLogs(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const daysToKeep = Number((req.body as any)?.daysToKeep ?? 90)
      const data = await service.cleanupLogs((req.user as any)?.role || undefined, daysToKeep)
      return (res as any).ok(data, '清理日志成功')
    } catch (error: any) {
      log.error('[log] 清理日志失败:', error)
      return respondError(res, error, '清理日志失败')
    }
  }

  /** 导出（CSV 新增地点列） */
  static async exportLogs(req: AuthRequest, res: Response) {
    try {
      const rows = await service.exportLogs(pickUser(req.user), req.query as any)
      const fmt = (req.query as any)?.format || 'csv'
      if (fmt === 'csv') {
        const header = 'ID,类型,级别,时间,用户,操作,资源,客户端,User-Agent,消息,详情,IP地址,地点,状态\n'
        const csv = (rows as any[])
          .map((log: any) => {
            const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details ?? '')
            const message = typeof log.message === 'string' ? log.message : JSON.stringify(log.message ?? '')
            const resource = log.resource_type ?? ''
            const client = log.client?.label || ''
            const ua = log.user_agent || ''
            const loc = log.location || log.geo?.label || ''
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
              loc.replace(/"/g, '""'),
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
      log.error('[log] 导出日志失败:', error)
      return (res as any).fail(CODES.INTERNAL_ERROR, 500, error?.message || '导出日志失败')
    }
  }
}
