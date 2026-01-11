/* eslint-disable @typescript-eslint/no-explicit-any */
import HttpError from '@/common/errors/http-error'
import { getClientIp } from '@/common/utils/request-ip'
import { CODES } from '@/types/response'
import type { Request } from 'express'
import type { LogInput, LogQueryParams } from '../domain/log.model'
import { LogRepository } from '../repositories/log.repository'
import Geo, { type GeoLocation } from '@/common/utils/geo'

let RC: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
})()

const LOG_TTL = 20
const kLogs = (ns: string, q: any) => `logs:${ns}:${JSON.stringify(q)}`

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = LOG_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdelByPattern(p: string) {
  try {
    const ks = await RC?.keys?.(p)
    if (ks?.length) await RC?.del?.(ks)
  } catch {}
}

// ---------- 轻量 UA 解析 ----------
type ClientType = 'desktop' | 'mobile' | 'tablet' | 'bot'
type ClientInfo = {
  label: string
  os: string
  browser: string
  device: string
  type: ClientType
}

function parseUA(uaRaw: string): ClientInfo {
  const ua = uaRaw || ''
  const isBot = /(bot|spider|crawler|bingbot|googlebot|yandex|headless|phantom|scrapy|python-requests|curl|wget)/i.test(
    ua
  )
  if (isBot) return { label: 'Bot · Unknown · Unknown', os: 'Unknown', browser: 'Unknown', device: 'Bot', type: 'bot' }

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
    device = isIPhone ? 'iPhone' : isAndroid ? ua.match(/Android.*; ([^;)]*)\)/)?.[1]?.trim() || 'Android' : 'Mobile'
    type = 'mobile'
  }

  const os = /Windows NT 11/.test(ua)
    ? 'Windows 11'
    : /Windows NT 10/.test(ua)
    ? 'Windows 10'
    : /Windows NT 6\.3/.test(ua)
    ? 'Windows 8.1'
    : /Windows NT 6\.1/.test(ua)
    ? 'Windows 7'
    : /Macintosh|Mac OS X/.test(ua)
    ? /(iPhone|iPad|iPod)/.test(ua)
      ? 'iOS'
      : 'macOS'
    : isAndroid
    ? 'Android'
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

  return { label: `${device} · ${os} · ${browser}`, os, browser, device, type }
}

const attachClient = (rows: any[]) => rows.map(r => ({ ...r, client: parseUA(r.user_agent || '') }))

// ---------- Geo 附加（带 IP 缓存） ----------
async function attachGeo<T extends { ip_address?: string | null }>(rows: T[]) {
  const cache = new Map<string, GeoLocation>()
  const out = await Promise.all(
    rows.map(async r => {
      const ip = r.ip_address || ''
      let geo = cache.get(ip)
      if (!geo) {
        geo = await Geo.lookup(ip)
        cache.set(ip, geo)
      }
      return { ...r, geo, location: geo.label }
    })
  )
  return out
}

// ---------- 请求元信息 ----------
// 直接接受 Request | undefined，避免 Pick<...,'socket'> 之类的类型冲突
const metaFromReq = (req?: Request | null) => ({
  ipAddress: req ? getClientIp(req as Request) : undefined,
  userAgent: req?.get?.('User-Agent') ?? (req as any)?.header?.('User-Agent') ?? undefined,
})

// ---------- level 推断 ----------
function inferLevel(input: LogInput): NonNullable<LogInput['level']> {
  if (input.level) return input.level
  const action = String(input.action || '')
  const msg = String(input.message || '')
  const status = String(input.status || '')
  if (/failed|error/i.test(status) || /失败|错误|异常|未授权|无权限/.test(msg)) return 'error'
  if (
    /(delete|remove|reset|ban|disable|unpublish|offline)/i.test(action) ||
    /(删除|移除|解绑|重置|禁用|停用|下线)/.test(action + msg)
  )
    return 'warn'
  if (
    /(create|insert|register|login|update|publish|start|submit|upload|import|export)/i.test(action) ||
    /(创建|新增|登录|更新|发布|开始|提交|上传|导入|导出)/.test(action + msg)
  )
    return 'info'
  return 'info'
}

export class LogService {
  static async log(input: LogInput, req?: Request) {
    const meta = metaFromReq(req)
    const startMs = (req as any)?.__req_start_ms
    const durationMs = typeof startMs === 'number' ? Date.now() - startMs : undefined
    const details =
      input.details && typeof input.details === 'object' && !Array.isArray(input.details) ? { ...input.details } : {}
    if (durationMs != null) details.duration_ms = durationMs

    await LogRepository.insert({
      type: input.type || 'system',
      level: inferLevel(input),
      userId: input.userId,
      // email 字段无需落表，这里只保留在内存上下文即可
      action: input.action,
      message: input.message,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: Object.keys(details).length ? details : input.details,
      status: input.status,
      ipAddress: input.ipAddress ?? meta.ipAddress,
      userAgent: input.userAgent ?? meta.userAgent,
    })
  }

  async getLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new HttpError('未授权访问', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const ck = kLogs('user', q)
    const cached = await cget(ck)
    if (cached) return cached

    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    const rows2 = await attachGeo(rows)
    const data = { logs: attachClient(rows2), total, page, limit }
    await cset(ck, data, 20)
    return data
  }

  async getSystemLogs(role: string | undefined, q: LogQueryParams) {
    const ck = kLogs('system', q)
    const cached = await cget(ck)
    if (cached) return cached

    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: 0, role: role || 'admin' }, q)
    const rows2 = await attachGeo(rows)
    const data = { logs: attachClient(rows2), total, page, limit }
    await cset(ck, data, 20)
    return data
  }

  async getAuditLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams & { type?: string }) {
    const baseQ: any = { ...q }
    if (!baseQ.type) baseQ.type = 'audit'

    if (user?.role === 'admin') {
      const ck = kLogs('audit_admin', baseQ)
      const cached = await cget(ck)
      if (cached) return cached

      const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: 0, role: 'admin' }, baseQ)
      const rows2 = await attachGeo(rows)
      const data = { logs: attachClient(rows2), total, page, limit }
      await cset(ck, data, 20)
      return data
    }

    if (!user?.id) throw new HttpError('未授权访问', 401, { code: CODES.AUTH_UNAUTHORIZED })

    const ck = kLogs(`audit_self:${user.id}`, baseQ)
    const cached = await cget(ck)
    if (cached) return cached

    const { rows, total, page, limit } = await LogRepository.queryLogs(
      { currentUserId: user.id, role: user.role },
      baseQ
    )
    const rows2 = await attachGeo(rows)
    const data = { logs: attachClient(rows2), total, page, limit }
    await cset(ck, data, 20)
    return data
  }

  async getLoginLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new HttpError('未授权访问', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const ck = kLogs('login', q)
    const cached = await cget(ck)
    if (cached) return cached

    const { rows, total, page, limit } = await LogRepository.queryLogs({ currentUserId: user.id, role: user.role }, q)
    const rows2 = await attachGeo(rows)
    const data = { logs: attachClient(rows2), total, page, limit }
    await cset(ck, data, 20)
    return data
  }

  async getExamLogs(user: { id?: number; role?: string } | undefined, examId: number, q: LogQueryParams) {
    if (!user?.id) throw new HttpError('未授权访问', 401, { code: CODES.AUTH_UNAUTHORIZED })
    return LogRepository.queryExamLogs({ currentUserId: user.id, role: user.role }, examId, q)
  }

  async cleanupLogs(role: string | undefined, daysToKeep: number) {
    if (role !== 'admin') throw new HttpError('权限不足', 403, { code: CODES.AUTH_FORBIDDEN })
    if (!Number.isFinite(daysToKeep) || daysToKeep < 0) throw new HttpError('daysToKeep 必须为非负数字')
    const affected = await LogRepository.cleanupOlderThan(new Date(Date.now() - daysToKeep * 86400_000))
    await cdelByPattern('logs:*')
    return { message: '日志清理完成', affected }
  }

  async exportLogs(user: { id?: number; role?: string } | undefined, q: LogQueryParams) {
    if (!user?.id) throw new Error('未授权访问')
    const rows = await LogRepository.exportLogs({ currentUserId: user.id, role: user.role }, q)
    const rows2 = await attachGeo(rows)
    return attachClient(rows2)
  }

  async getOnlineUsers(user: { id?: number; role?: string } | undefined) {
    if (!user?.id) throw new HttpError('未授权访问', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const ck = kLogs('online', {})
    const cached = await cget(ck)
    if (cached) return cached

    const rows = await LogRepository.queryOnlineUsersFromLogs()
    const rows2 = await attachGeo(rows as any)
    const out = (rows2 || []).map(r => {
      const client = parseUA((r as any).user_agent || '')
      return {
        id: (r as any).id ?? 0,
        email: (r as any).email ?? '', // ✅ 返回邮箱
        ip_address: (r as any).ip_address ?? '',
        login_time: (r as any).login_time,
        client,
        os: client.os,
        browser: client.browser,
        location: (r as any).location,
        geo: (r as any).geo,
        country: (r as any).geo?.country,
        region: (r as any).geo?.region,
        city: (r as any).geo?.city,
      }
    })
    await cset(ck, out, 10)
    return out
  }

  async kickOnlineUser(user: { id?: number; role?: string } | undefined, targetId: string | number) {
    if ((user as any)?.role !== 'admin') throw new HttpError('权限不足', 403, { code: CODES.AUTH_FORBIDDEN })
    await LogRepository.insert({
      type: 'login',
      level: 'info',
      userId: user?.id,

      action: 'force_logout',
      message: '管理员强制下线',
      resourceType: 'session',
      resourceId: typeof targetId === 'string' ? Number(targetId) || undefined : targetId,
      status: 'success',
    })
    return { id: targetId }
  }
}

export default LogService
