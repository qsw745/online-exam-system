import type { Request } from 'express'
import type { LogInput, LogQueryParams } from '../domain/log.model'
import { LogRepository } from '../repositories/log.repository'
import type { LogRow } from '../domain/log.model'

/** 轻量 UA 解析（设备/OS/浏览器，给前端友好显示） */
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
    else if (/Android/.test(s)) {
      const m = s.match(/Android.*; ([^;)]*)\)/)
      device = m?.[1]?.trim() || 'Android'
    } else device = 'Mobile'
  }
  return { label: `${device} · ${os} · ${browser}`, os, browser, device }
}

const attachClient = (rows: LogRow[]) => rows.map(r => ({ ...r, client: parseUA(r.user_agent || '') }))

const metaFromReq = (req?: Pick<Request, 'ip' | 'get'> | null) => ({
  ipAddress: req?.ip,
  userAgent: req?.get('User-Agent') || undefined,
})

/** 自动判定日志级别（可被入参 level 覆盖） */
function inferLevel(input: LogInput): LogInput['level'] {
  if (input.level) return input.level
  // 明确失败/错误
  if (typeof input.status === 'string' && /failed|error/i.test(input.status)) return 'error'
  // action 语义
  if (input.action) {
    if (/delete|remove|reset|ban|disable/i.test(input.action)) return 'warn'
    if (/create|insert|register|login|update|upload|import|export/i.test(input.action)) return 'info'
  }
  // system 默认 info
  if (input.type === 'system') return 'info'
  // 兜底
  return 'info'
}

/** —— Service：对外仅暴露一个“写日志”方法 + 若干“读日志”方法 —— */
export class LogService {
  /** ✅ 统一写日志入口：所有模块只调用这个 */
  static async log(input: Omit<LogInput, 'ipAddress' | 'userAgent'>, req?: Request) {
    const meta = metaFromReq(req)
    const normalized: LogInput = {
      ...input,
      level: inferLevel(input),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }
    await LogRepository.insert(normalized)
  }

  /** ✅ 列表查询（带权限范围） */
  async getLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getSystemLogs(role: string | undefined, q: LogQueryParams) {
    // 复用 queryLogs，传入 admin scope + module/level 等过滤
    const { rows, total, page, limit } = await LogRepository.queryLogs(
      { currentUserId: 0, role: role || 'admin' }, // 非 admin 也可以查，但控制器会做权限限制
      q
    )
    return { logs: attachClient(rows), total, page, limit }
  }

  async getAuditLogs(role: string | undefined, q: LogQueryParams) {
    const merged: LogQueryParams = { ...q, module: q.module || undefined }
    const { rows, total, page, limit } = await LogRepository.queryLogs(
      { currentUserId: 0, role: role || 'admin' },
      merged
    )
    return { logs: attachClient(rows), total, page, limit }
  }

  async getLoginLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    // 仍用通用查询（角色限制在 repository where 中处理）
    const { rows, total, page, limit } = await LogRepository.queryLogs(
      { currentUserId: user.id, role: user.role },
      { ...q, action: q.action ?? undefined }
    )
    return { logs: attachClient(rows), total, page, limit }
  }

  /** 🔧 修复：补全 getExamLogs 给控制器调用 */
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
