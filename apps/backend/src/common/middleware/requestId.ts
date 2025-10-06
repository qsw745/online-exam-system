// apps/backend/src/common/middleware/requestId.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express'

declare const process: any

function genFallbackId() {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `rid_${t}_${r}`
}

export function requestId() {
  return function reqIdMiddleware(req: Request, res: Response, next: NextFunction) {
    // 允许客户端透传；否则生成
    const incoming = req.get('x-request-id') || req.get('x-requestid') || req.get('request-id') || undefined

    const rid = (incoming && String(incoming)) || (globalThis.crypto?.randomUUID?.() ?? genFallbackId())

    ;(req as any).id = rid
    ;(req as any).requestId = rid
    res.setHeader('X-Request-Id', rid)

    // 给响应记录开始时间，供 responseEnvelope 里计算 duration
    try {
      if (process?.hrtime?.bigint) (res as any).__res_start_hrtime = process.hrtime.bigint()
      else if (process?.hrtime) (res as any).__res_start_hrtime = process.hrtime()
    } catch {}

    next()
  }
}

export default requestId
