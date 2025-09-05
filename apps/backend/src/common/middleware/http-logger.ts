// apps/backend/src/common/middleware/http-logger.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { reqLogger } from '@infrastructure/logging/logger'

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

export function httpLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint()
    const rid = (req as any).id || cryptoRandomLike()
    const base = reqLogger({
      rid,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
      svc: 'backend',
      time: formatTime(),
    })

    ;(req as any).log = base
    ;(req as any).onError = (err: any) => {
      base.error('request error', {
        status: (err && err.status) || 500,
        code: err?.code,
        msg: err?.message,
        stack: err?.stack, // ✅ 打完整堆栈
        details: err?.details,
      })
    }

    res.on('finish', () => {
      const ms = Number((process.hrtime.bigint() - start) / 1000000n)
      const status = res.statusCode
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
      const bytes = Number(res.getHeader('content-length') || 0)
      base.log(level as any, 'request completed', {
        statusCode: status,
        responseTime: ms,
        resBytes: bytes,
      })
    })

    next()
  }
}

function cryptoRandomLike() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}
