// apps/backend/src/types/express.d.ts
import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    /** requestId 中间件写入 */
    id?: string
    /** http-logger 想挂一个错误回调 */
    onError?: (err: unknown) => void
    /** 供 error-handler 打日志使用，可在 http-logger 里注入 */
    log?: Console
  }
}
