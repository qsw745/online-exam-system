// apps/backend/src/common/middleware/http-logger.ts
/* eslint-disable @/typescript-eslint/no-explicit-any */
declare const process: any

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { reqLogger } from '@/infrastructure/logging/logger'

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
    const start = Date.now()
    const rid = (req as any).id || cryptoRandomLike()
    const base = reqLogger({
      rid,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: (req.get('x-forwarded-for') as string) || (req as any).socket?.remoteAddress,
      svc: 'backend',
      time: formatTime(),
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
    ;(res as any).on?.('finish', () => {
      const ms = Date.now() - start
      const status = (res as any).statusCode as number
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
      const bytes = Number((res as any).getHeader?.('content-length') || 0)
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
