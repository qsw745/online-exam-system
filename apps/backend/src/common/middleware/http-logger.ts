// apps/backend/src/common/middleware/http-logger.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { reqLogger } from '@/infrastructure/logging/logger'
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

/**
 * 统一 http 访问日志。
 * 关键：IP 统一通过 getClientIp(req) 解析（需配合 app.set('trust proxy', true) 与代理透传头）
 */
export function httpLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    const rid = (req as any).id || cryptoRandomLike()

    // ✅ 解析真实客户端 IP，并可供后续处理使用
    const clientIp = getClientIp(req)
    ;(req as any).clientIp = clientIp

    const base = reqLogger({
          rid,
          method: req.method,
          url: (req as any).originalUrl || req.url,
          ip: clientIp,
          svc: 'backend',
          time: formatTime(),
          ua: req.get('user-agent') || undefined,
          referer: req.get('referer') || undefined,
        })

        // 将 logger 挂到 req，方便控制器里使用
    ;(req as any).log = base

    // 统一错误回调（被全局 errorHandler 调用）
    ;(req as any).onError = (err: any) => {
      base.error('request error', {
        status: (err && err.status) || 500,
        code: err?.code,
        msg: err?.message,
        stack: err?.stack,
        details: err?.details,
      })
    }

    // 记录完成
    res.once('finish', () => {
      const ms = Date.now() - start
      const status = res.statusCode
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
      const len = res.getHeader('content-length')
      const bytes = Array.isArray(len) ? Number(len[0]) : Number(len ?? 0)

      base.log(level as any, 'request completed', {
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
