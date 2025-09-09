// apps/backend/src/common/middleware/requestId.ts
import type { Request, Response, NextFunction } from 'express'

// 在没有 @types/node 的环境下，给 process 做最小声明
declare const process: any

declare global {
  // 给 req 挂上 id（避免 TypeScript 报错）
  // eslint-disable-next-line no-var
  var __REQ_ID_SYMBOL__: symbol | undefined
}

const REQ_ID = globalThis.__REQ_ID_SYMBOL__ ?? Symbol('req.id')
globalThis.__REQ_ID_SYMBOL__ = REQ_ID

export function requestId() {
  return function reqIdMiddleware(
    req: Request & { [REQ_ID]?: string; id?: string },
    res: Response,
    next: NextFunction
  ) {
    // 允许客户端透传 X-Request-Id，否则生成
    const incoming = req.get('x-request-id') || req.get('x-requestid') || req.get('request-id') || undefined

    const rid = (incoming && String(incoming)) || (globalThis.crypto?.randomUUID?.() ?? genFallbackId())
    req[REQ_ID] = rid
    ;(req as any).id = rid // 方便其他中间件读取
    res.header('X-Request-Id', rid)
    next()
  }
}

function genFallbackId() {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `rid_${t}_${r}`
}
