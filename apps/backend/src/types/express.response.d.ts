// apps/backend/src/types/express.response.d.ts
import 'express-serve-static-core'

declare global {
  namespace Express {
    interface Response {
      ok<T = any>(data?: T, message?: string, extra?: any): this
      created<T = any>(data?: T, message?: string, extra?: any): this
      badRequest(message?: string, extra?: any): this
      unauthorized(message?: string, extra?: any): this
      forbidden(message?: string, extra?: any): this
      notFound(message?: string, extra?: any): this
      tooMany(message?: string, extra?: any): this
      conflict?(message?: string, extra?: any): this
      internal(message?: string, extra?: any): this
      fail(code: string, httpStatus?: number, message?: string, extra?: any): this
    }
  }
}

export {}
