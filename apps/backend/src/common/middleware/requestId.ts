// apps/backend/src/common/middleware/requestId.ts
import type { Request, Response, NextFunction } from 'express'

// 最小声明，避免某些环境缺少 Node 类型时报错
declare const process: any

declare global {
  // eslint-disable-next-line no-var
  var __REQ_ID_SYMBOL__: symbol | undefined
  // eslint-disable-next-line no-var
  var __REQ_START_SYMBOL__: symbol | undefined
}

const REQ_ID = globalThis.__REQ_ID_SYMBOL__ ?? Symbol('req.id')
globalThis.__REQ_ID_SYMBOL__ = REQ_ID

const REQ_START = globalThis.__REQ_START_SYMBOL__ ?? Symbol('req.start')
globalThis.__REQ_START_SYMBOL__ = REQ_START

export function requestId() {
  return function reqIdMiddleware(
      req: Request & { [REQ_ID]?: string; [REQ_START]?: any; id?: string },
      res: Response,
      next: NextFunction
  ) {
    // 允许客户端透传；否则生成
    const incoming =
        req.get('x-request-id') || req.get('x-requestid') || req.get('request-id') || undefined

    const rid =
        (incoming && String(incoming)) ||
        (globalThis.crypto?.randomUUID?.() ?? genFallbackId())

    req[REQ_ID] = rid
    ;(req as any).id = rid
    res.header('X-Request-Id', rid)

    // 记录开始时间用于耗时
    req[REQ_START] = process?.hrtime?.bigint ? process.hrtime.bigint() : process.hrtime()

    next()
  }
}

export function readRequestId(req: Request & { [REQ_ID]?: string }): string {
  return (req as any)[REQ_ID] || ''
}

export function endTimer(start: any): number | undefined {
  try {
    if (typeof start === 'bigint' && process?.hrtime?.bigint) {
      const ns = (process.hrtime.bigint() - start) as bigint
      return Number(ns / BigInt(1_000_000)) // ms
    }
    if (process?.hrtime) {
      const diff = process.hrtime(start)
      return Math.round(diff[0] * 1e3 + diff[1] / 1e6)
    }
    return undefined
  } catch {
    return undefined
  }
}

function genFallbackId() {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `rid_${t}_${r}`
}
