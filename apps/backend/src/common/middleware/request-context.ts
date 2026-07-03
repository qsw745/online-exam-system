import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response, NextFunction, RequestHandler } from 'express'

export interface RequestContext {
  method: string
  path: string
}

const als = new AsyncLocalStorage<RequestContext>()

/** 请求上下文：让深层服务（如日志入库）无需层层传 req 也能拿到当前请求的 method/path */
export function requestContext(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ctx: RequestContext = {
      method: req.method,
      path: ((req as any).originalUrl || req.url || '').split('?')[0],
    }
    als.run(ctx, () => next())
  }
}

/** 当前请求上下文；不在请求链路中（如定时任务）时返回 undefined */
export function getRequestContext(): RequestContext | undefined {
  return als.getStore()
}
