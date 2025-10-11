/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { log } from '@/infrastructure/logging/logger'
import { getClientIp } from '@/common/utils/request-ip'

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
    const rid = cryptoRandomLike()

    const clientIp = getClientIp(req)
    ;(req as any).clientIp = clientIp

    const base = log.with({
      rid,
      method: req.method,
      url: (req as any).originalUrl || req.url,
      ip: clientIp,
      svc: 'backend',
      time: formatTime(),
      ua: req.get('user-agent') || undefined,
      referer: req.get('referer') || undefined,
    })
    ;(req as any).log = base
    ;(req as any).onError = (err: any) => {
      base.error('request error', {
        status: (err && err.status) || 500,
        code: err?.code,
        msg: err?.message,
        stack: err?.stack,
        details: err?.details,
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

function cryptoRandomLike() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}
