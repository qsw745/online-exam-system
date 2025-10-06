// apps/backend/src/@types/express/index.d.ts
import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    /** 我们在 requestId 中间件里赋值的请求ID（同 res header: X-Request-Id） */
    id?: string
    requestId?: string
  }

  interface Response {
    ok: (data?: any, message?: string, extra?: any) => this
    created: (data?: any, message?: string, extra?: any) => this
    fail: (code: string, status?: number, message?: string, extra?: any) => this
    badRequest: (message?: string, extra?: any) => this
    unauthorized: (message?: string, extra?: any) => this
    forbidden: (message?: string, extra?: any) => this
    tooMany: (message?: string, extra?: any) => this
    internal: (message?: string, extra?: any) => this
  }
}
