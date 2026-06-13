// apps/backend/src/common/async-handler.ts
import type { RequestHandler } from 'express'
export function named(name: string, fn: RequestHandler): RequestHandler {
  const wrap: RequestHandler = (req, res, next) => {
    ;(req as any).__handlerName = name
    try {
      const p = (fn as any)(req, res, next)
      if (p && typeof (p as any).then === 'function') (p as any).catch(next)
    } catch (e) {
      next(e)
    }
  }
  return wrap
}
