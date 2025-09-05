// apps/backend/src/common/middleware/requestId.ts
import type { Request, Response, NextFunction } from 'express'

declare global {
  // 给 req 挂上 id（避免 TypeScript 报错）
  // eslint-disable-next-line no-var
  var __REQ_ID_SYMBOL__: symbol | undefined
}

const REQ_ID = globalThis.__REQ_ID_SYMBOL__ ?? Symbol('req.id')
globalThis.__REQ_ID_SYMBOL__ = REQ_ID

export function requestId() {
  return function reqIdMiddleware(req: Request & { [REQ_ID]?: string; id?: string }, res: Response, next: NextFunction) {
    // 允许客户端透传 X-Request-Id（比如前端或网关生成），否则生成
    const incoming = (req.headers['x-request-id'] || req.headers['x-requestid'] || req.headers['request-id']) as
      | string
      | undefined

    const rid = (incoming && String(incoming)) || (globalThis.crypto?.randomUUID?.() ?? genFallbackId())
    req[REQ_ID] = rid
    ;(req as any).id = rid // 方便中间件（比如 morgan/pino）读取
    res.setHeader('X-Request-Id', rid)

    // 在 res 结束时带上耗时（可选）
    const start = process.hrtime.bigint()
    res.on('finish', () => {
      const costMs = Number((process.hrtime.bigint() - start) / 1000000n)
      // 这条仅作为兜底输出，详细日志交给 httpLogger
      // console.debug(`[rid=${rid}] response finished in ${costMs}ms`)
    })

    next()
  }
}

function genFallbackId() {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `rid_${t}_${r}`
}
