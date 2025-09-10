// apps/backend/src/modules/logs/services/log.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request } from 'express'
import type { LogInput, LogQueryParams, LogRow } from '../domain/log.model'
import { LogRepository } from '../repositories/log.repository'

/** 轻量 UA 解析（设备/OS/浏览器）*/
function parseUA(ua: string) {
  const s = ua || ''
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(s)
  const os = /Windows NT 11/.test(s)
    ? 'Windows 11'
    : /Windows NT 10/.test(s)
    ? 'Windows 10'
    : /Macintosh|Mac OS X/.test(s)
    ? 'macOS'
    : /Android/.test(s)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(s)
    ? 'iOS'
    : /Linux/.test(s)
    ? 'Linux'
    : 'Unknown'
  const browser = /Edg\/\d+/.test(s)
    ? 'Edge'
    : /Safari\/\d+/.test(s) && /Version\/\d+/.test(s)
    ? 'Safari'
    : /Chrome\/\d+/.test(s)
    ? 'Chrome'
    : /Firefox\/\d+/.test(s)
    ? 'Firefox'
    : /MSIE|Trident\//.test(s)
    ? 'IE'
    : 'Unknown'
  let device = 'Desktop'
  if (isMobile) {
    if (/iPhone/.test(s)) device = 'iPhone'
    else if (/iPad/.test(s)) device = 'iPad'
    else if (/Android/.test(s)) device = s.match(/Android.*; ([^;)]*)\)/)?.[1]?.trim() || 'Android'
    else device = 'Mobile'
  }
  return { label: `${device} · ${os} · ${browser}`, os, browser, device }
}

const attachClient = (rows: LogRow[]) => rows.map(r => ({ ...r, client: parseUA(r.user_agent || '') }))

const metaFromReq = (req?: Pick<Request, 'ip' | 'get'> | null) => ({
  ipAddress: req?.ip,
  userAgent: req?.get('User-Agent') || undefined,
})

/** 自动推断 level（可被入参覆盖） */
function inferLevel(input: LogInput): NonNullable<LogInput['level']> {
  if (input.level) return input.level
  if (typeof input.status === 'string' && /failed|error/i.test(input.status)) return 'error'
  if (typeof input.status === 'string' && /warn/i.test(input.status)) return 'warn'
  if (input.action) {
    if (/delete|remove|reset|ban|disable/i.test(input.action)) return 'warn'
    if (/create|insert|register|login|update|upload|import|export/i.test(input.action)) return 'info'
  }
  return 'info'
}

export class LogService {
  /** ✅ 唯一写日志入口：所有模块只调用这个 */
  static async log(input: LogInput, req?: Request) {
    const meta = metaFromReq(req)
    await LogRepository.insert({
      type: input.type || 'system',
      level: inferLevel(input),
      userId: input.userId,
      username: input.username,
      action: input.action,
      message: input.message,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details,
      status: input.status,
      // 允许调用方传入覆盖；未传则使用 req 的值
      ipAddress: input.ipAddress ?? meta.ipAddress,
      userAgent: input.userAgent ?? meta.userAgent,
    })
  }

  /** ✅ 列表查询（带权限范围） */
  async getLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getSystemLogs(role: string | undefined, q: LogQueryParams) {
    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: 0, role: role || 'admin' }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getAuditLogs(role: string | undefined, q: LogQueryParams) {
    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: 0, role: role || 'admin' }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getLoginLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  /** 给控制器用的考试日志查询 */
  async getExamLogs(user: { id?: number; role?: string } | undefined, examId: number, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    return LogRepository.queryExamLogs({ currentUserId: user.id, role: user.role }, examId, q)
  }

  async cleanupLogs(role: string | undefined, daysToKeep: number) {
    if (role !== 'admin') throw new Error('权限不足')
    if (!Number.isFinite(daysToKeep) || daysToKeep < 0) throw new Error('daysToKeep 必须为非负数字')
    const affected = await LogRepository.cleanupOlderThan(new Date(Date.now() - daysToKeep * 86400_000))
    return { message: '日志清理完成', affected }
  }

  async exportLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    const rows = await LogRepository.exportLogs({ currentUserId: user.id, role: user.role }, q)
    return attachClient(rows)
  }
}

export default LogService
