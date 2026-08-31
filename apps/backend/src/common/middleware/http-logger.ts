/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { isIP } from 'node:net'
import { randomUUID } from 'node:crypto'
import { log } from '@/infrastructure/logging/logger'
import { getClientIp } from '@/common/utils/request-ip'
import { redactSensitiveFields, redactSensitiveText } from '@/common/logging/sensitive-field-redaction'

function formatTime(d = new Date()) {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

/** 统一 http 访问日志 */
export function httpLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    ;(req as any).__req_start_ms = (req as any).__req_start_ms || start
    const rid = String((req as any).id || randomUUID())

    const clientIp = getClientIp(req) ?? ''
    ;(req as any).clientIp = clientIp

    const base = log.with(buildHttpLogContext({
      requestId: rid,
      method: req.method,
      path: req.path,
      clientIp,
      now: new Date(),
    }))
    ;(req as any).log = base
    ;(req as any).onError = (err: any) => {
      base.error('request error', {
        status: (err && err.status) || 500,
        code: err?.code,
        type: err?.name,
        msg: redactSensitiveText(err?.message),
        details: redactSensitiveFields(err?.details),
      })
    }

    // ✅ 避免类型报错：把 res 强转为 any 再调用 on()
    ;(res as any).on?.('finish', () => {
      const ms = Date.now() - start
      const status: number = (res as any).statusCode
      const level = (status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info') as 'error' | 'warn' | 'info'

      const len = (res as any).getHeader?.('content-length')
      const bytes = Array.isArray(len) ? Number(len[0]) : Number(len ?? 0)

      base.log(level, 'request completed', {
        statusCode: status,
        responseTime: ms,
        resBytes: Number.isFinite(bytes) ? bytes : undefined,
      })
    })

    next()
  }
}

const expandIpv6 = (value: string): string[] | null => {
  const [leftRaw, rightRaw, ...extra] = value.toLowerCase().split('::')
  if (extra.length > 0) return null
  const left = leftRaw ? leftRaw.split(':') : []
  const right = rightRaw ? rightRaw.split(':') : []
  if (left.some(part => !/^[0-9a-f]{1,4}$/.test(part)) || right.some(part => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null
  }
  const missing = 8 - left.length - right.length
  if ((value.includes('::') && missing < 1) || (!value.includes('::') && missing !== 0)) return null
  return [...left, ...Array.from({ length: missing }, () => '0'), ...right]
}

export function coarsenIpForLogging(rawValue: unknown): string {
  const value = String(rawValue ?? '').trim().split(',')[0]?.trim().replace(/%.+$/, '') ?? ''
  const mappedIpv4 = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1]
  const candidate = mappedIpv4 ?? value
  if (isIP(candidate) === 4) {
    const parts = candidate.split('.').map(Number)
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
  }
  if (isIP(candidate) === 6) {
    const expanded = expandIpv6(candidate)
    if (!expanded) return 'ipv6/48'
    return `${expanded.slice(0, 3).map(part => Number.parseInt(part, 16).toString(16)).join(':')}::/48`
  }
  return 'unknown'
}

export function buildHttpLogContext(input: {
  requestId: string
  method: string
  path: string
  clientIp: string
  now?: Date
}) {
  return {
    rid: input.requestId,
    method: input.method,
    url: input.path,
    ip: coarsenIpForLogging(input.clientIp),
    svc: 'backend',
    time: formatTime(input.now),
  }
}
