import 'express-serve-static-core'
import 'express'

declare module 'express-serve-static-core' {
  interface Request {
    /** 统一字符串 requestId（避免 symbol 带来的 TS1170 报错） */
    requestId?: string
    user?: { id: number; [k: string]: any } // 如已有其它地方声明，可保留一份即可
  }

  interface Response {
    ok<T = any>(data?: T, message?: string, extra?: any): this
    created<T = any>(data?: T, message?: string, extra?: any): this

    /** 语义化 4xx/5xx */
    badRequest(message?: string, extra?: any): this
    unauthorized(message?: string, extra?: any): this
    forbidden(message?: string, extra?: any): this
    notFound(message?: string, extra?: any): this
    tooMany(message?: string, extra?: any): this
    internal(message?: string, extra?: any): this

    /** 自定义失败输出（与中间件实现保持一致） */
    fail(code: string, httpStatus?: number, message?: string, extra?: any): this
  }
}

// 避免成为全局脚本模块
export {}
