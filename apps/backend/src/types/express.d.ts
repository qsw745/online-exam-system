// apps/backend/src/types/express.d.ts
import 'express-serve-static-core'
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'express'

declare module 'express-serve-static-core' {
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
