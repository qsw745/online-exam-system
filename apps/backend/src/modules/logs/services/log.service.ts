// apps/backend/src/modules/logs/services/log.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request } from 'express'
import type { LogInput, LogQueryParams, LogRow } from '../domain/log.model'
import { LogRepository } from '../repositories/log.repository'
import { getClientIp } from '@/common/utils/request-ip'
import HttpError from '@/common/errors/http-error'
import { CODES } from '@/types/response'

// ---------- 轻量 UA 解析 ----------
type ClientType = 'desktop' | 'mobile' | 'tablet' | 'bot'
type ClientInfo = {
  label: string
  os: string
  browser: string
  device: string
  type: ClientType
}

/** 返回 os/browser/device + type（desktop/mobile/tablet/bot） */
function parseUA(uaRaw: string): ClientInfo {
  const ua = uaRaw || ''

  // 1) 爬虫/脚本
  const isBot = /(bot|spider|crawler|bingbot|googlebot|yandex|headless|phantom|scrapy|python-requests|curl|wget)/i.test(ua)
  if (isBot) {
    return { label: 'Bot · Unknown · Unknown', os: 'Unknown', browser: 'Unknown', device: 'Bot', type: 'bot' }
  }

  // 2) 设备类型
  const isIPad = /iPad/.test(ua)
  const isIPhone = /iPhone/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isMobile = /Mobile|Windows Phone|iPhone|iPod/.test(ua) || (isAndroid && /Mobile/i.test(ua))
  const isTablet = isIPad || (isAndroid && !/Mobile/i.test(ua)) || /Tablet|Nexus 7|Nexus 10/i.test(ua)

  let device = 'Desktop'
  let type: ClientType = 'desktop'
  if (isTablet) {
    device = isIPad ? 'iPad' : 'Tablet'
    type = 'tablet'
  } else if (isMobile) {
    if (isIPhone) device = 'iPhone'
    else if (isAndroid) device = ua.match(/Android.*; ([^;)]*)\)/)?.[1]?.trim() || 'Android'
    else device = 'Mobile'
    type = 'mobile'
  }

  // 3) OS
  const os =
      /Windows NT 11/.test(ua) ? 'Windows 11' :
          /Windows NT 10/.test(ua) ? 'Windows 10' :
              /Windows NT 6\.3/.test(ua) ? 'Windows 8.1' :
                  /Windows NT 6\.1/.test(ua) ? 'Windows 7' :
                      /Macintosh|Mac OS X/.test(ua) ? (/(iPhone|iPad|iPod)/.test(ua) ? 'iOS' : 'macOS') :
                          isAndroid ? 'Android' :
                              /Linux/.test(ua) ? 'Linux' : 'Unknown'

  // 4) Browser（判定顺序很重要）
  const browser =
      /Edg\/\d+/.test(ua) ? 'Edge' :
          (/Chrome\/\d+/.test(ua) && !/Edg\/\d+/.test(ua)) ? 'Chrome' :
              (/Safari\/\d+/.test(ua) && /Version\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua)) ? 'Safari' :
                  /Firefox\/\d+/.test(ua) ? 'Firefox' :
                      /MSIE|Trident\//.test(ua) ? 'IE' : 'Unknown'

  return { label: `${device} · ${os} · ${browser}`, os, browser, device, type }
}

// rows 附带 client（含 type）
const attachClient = (rows: LogRow[]) =>
    rows.map(r => ({ ...r, client: parseUA(r.user_agent || '') }))

// ---------- 请求元信息 ----------
const metaFromReq = (req?: Pick<Request, 'ip' | 'get' | 'headers' | 'socket'> | null) => ({
  ipAddress: req ? getClientIp(req as Request) : undefined,
  userAgent: req?.get?.('User-Agent') || (req as any)?.headers?.['user-agent'] || undefined,
})

// ---------- level 推断（英文 + 中文关键字） ----------
function inferLevel(input: LogInput): NonNullable<LogInput['level']> {
  if (input.level) return input.level

  const action = String(input.action || '')
  const msg = String(input.message || '')
  const status = String(input.status || '')

  // 明确失败
  if (/failed|error/i.test(status) || /失败|错误|异常|未授权|无权限/.test(msg)) return 'error'

  // 危险/破坏性操作 → warn
  if (
      /(delete|remove|reset|ban|disable|unpublish|offline)/i.test(action) ||
      /(删除|移除|解绑|重置|禁用|停用|下线)/.test(action + msg)
  ) {
    return 'warn'
  }

  // 常规变更 → info
  if (
      /(create|insert|register|login|update|publish|start|submit|upload|import|export)/i.test(action) ||
      /(创建|新增|登录|更新|发布|开始|提交|上传|导入|导出)/.test(action + msg)
  ) {
    return 'info'
  }

  return 'info'
}

// ---------- Service ----------
export class LogService {
  /** 统一写日志入口（message 建议中文） */
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
      ipAddress: input.ipAddress ?? meta.ipAddress,
      userAgent: input.userAgent ?? meta.userAgent,
    })
  }

  async getLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new HttpError('未授权访问', 401, CODES.AUTH_UNAUTHORIZED)
    const { rows, total, page, limit } =
        await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getSystemLogs(role: string | undefined, q: LogQueryParams) {
    const { rows, total, page, limit } =
        await LogRepository.queryLogs({ currentUserId: 0, role: role || 'admin' }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getAuditLogs(role: string | undefined, q: LogQueryParams) {
    const { rows, total, page, limit } =
        await LogRepository.queryLogs({ currentUserId: 0, role: role || 'admin' }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getLoginLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new HttpError('未授权访问', 401, CODES.AUTH_UNAUTHORIZED)
    const { rows, total, page, limit } =
        await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    return { logs: attachClient(rows), total, page, limit }
  }

  async getExamLogs(user: { id?: number; role?: string } | undefined, examId: number, q: LogQueryParams) {
    if (!user?.id) throw new HttpError('未授权访问', 401, CODES.AUTH_UNAUTHORIZED)
    return LogRepository.queryExamLogs({ currentUserId: user.id, role: user.role }, examId, q)
  }

  async cleanupLogs(role: string | undefined, daysToKeep: number) {
    if (role !== 'admin') throw new HttpError('权限不足', 403, CODES.AUTH_FORBIDDEN)
    if (!Number.isFinite(daysToKeep) || daysToKeep < 0) throw new HttpError('daysToKeep 必须为非负数字')
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
