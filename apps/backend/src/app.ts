/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'path' {
  const anyExport: any
  export = anyExport
}
declare module 'fs' {
  const anyExport: any
  export = anyExport
}
declare const process: any
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import 'source-map-support/register'
import 'tsconfig-paths/register'

// 中间件
import { optionalAuth } from '@common/middleware/auth'
import { httpLogger } from '@common/middleware/http-logger'
import { requestId } from '@common/middleware/requestId'

// 路由（默认导出：Router 或 工厂函数）
import apiRoutesOrFactory from '@routes'

// 启动期菜单同步
import { syncMenus } from './bootstrap/syncMenus'

// 时间格式
import { formatTime } from '@infrastructure/logging/logger'

type ApiResponse<T> = { success: boolean; data?: T | null; error?: string; details?: any }

/** uploads 目录 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()

// 静态资源也挂在 /api 下，避免与前端路由冲突
app.use('/api/uploads', express.static(UPLOADS_DIR))

// 顺序很重要：请求 ID -> CORS -> 解析体 -> 可选鉴权 -> 请求日志
app.use(requestId())

const FRONTEND_ORIGIN = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
)

app.use(cookieParser())
app.use(express.json({ limit: '5mb' }))
app.use(optionalAuth)
app.use(httpLogger())

/** 健康检查（放在 /api 下） */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: formatTime() })
})

/** ====== 错误辅助 ====== */
function pickTopBusinessFrame(stack?: string) {
  if (!stack) return null
  const lines = stack.split('\n').slice(1)
  for (const l of lines) {
    let m = l.match(/\s*at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/)
    if (!m) {
      m = l.match(/\s*at\s+(.*?):(\d+):(\d+)/)
      if (m) {
        const [, file, line, column] = m
        if (file.includes('node:') || file.includes('node_modules')) continue
        return { method: undefined, file, line: Number(line), column: Number(column) }
      }
      continue
    }
    const [, method, file, line, column] = m
    if (file.includes('node:') || file.includes('node_modules')) continue
    return { method, file, line: Number(line), column: Number(column) }
  }
  return null
}

function safeJson(obj: any, max = 4000) {
  try {
    const s = JSON.stringify(obj)
    return s.length > max ? s.slice(0, max) + '…(truncated)' : s
  } catch {
    return undefined
  }
}

/** 启动 */
const port = Number(process.env.PORT || 3000)
async function start() {
  try {
    // 兼容两种导出：Router 或 工厂函数
    const maybe = apiRoutesOrFactory as any
    const apiRouter = typeof maybe === 'function' && !(maybe.use && maybe.handle) ? await maybe() : maybe

    if (!apiRouter?.use || !apiRouter?.handle) {
      throw new Error('[@routes] default export is neither an Express Router nor a factory returning a Router')
    }

    // 先挂载业务路由（统一前缀）
    app.use('/api', apiRouter)

    /** —— 只有当且仅当上面的路由匹配不到时，才会落到这个 API 404 —— */
    app.use('/api', (req: Request, res: Response<ApiResponse<null>>) => {
      res.status(404).json({ success: false, error: '请求的资源不存在' })
    })

    /** —— 统一错误处理：⚠️ 必须在所有路由/404 之后 —— */
    app.use((err: any, req: Request, res: Response<ApiResponse<null>>, _next: NextFunction) => {
      const log = (req as any).log ?? console
      const status = typeof err?.status === 'number' ? err.status : 500
      ;(req as any).onError?.(err)

      const top = pickTopBusinessFrame(err?.stack)
      const short =
        `[error-handler] ${err?.name || 'Error'}: ${String(err?.message ?? err)}` +
        (top ? ` @ ${top.file}:${top.line}:${top.column}${top.method ? ` (${top.method})` : ''}` : '')

      const reqDump =
        req.method === 'GET' || req.method === 'HEAD'
          ? { params: req.params, query: req.query }
          : { params: req.params, query: req.query, body: JSON.parse(safeJson(req.body) || 'null') }

      log[status >= 500 ? 'error' : 'warn']?.(short, {
        rid: (req as any).id ?? null,
        method: req.method,
        url: req.originalUrl || req.url,
        routePath: (req as any).route?.path || null,
        handler: (req as any).__handlerName ?? null,
        error: {
          type: err?.name,
          message: String(err?.message ?? err),
          stack: err?.stack,
          code: err?.code,
          status,
          details: err?.details,
          ctx: err?.ctx,
        },
        request: reqDump,
      })

      res.status(status).json({
        success: false,
        error: err?.message || '服务器内部错误',
        ...(err?.details ? { details: err.details } : null),
      })
    })

    await syncMenus?.({ removeOrphans: false, mode: 'patch' }).catch((e: any) => {
      console.warn('[menu-sync] failed at boot:', e?.message || e)
    })

    app.listen(port, '0.0.0.0', () => {
      console.log(`[boot] server at http://localhost:${port} (0.0.0.0:${port})`)
      console.log(`[boot] uploads dir = ${UPLOADS_DIR}`)
    })
  } catch (e) {
    console.error('[boot] failed:', e)
    process.exit(1)
  }
}

start()

process.on('uncaughtException', (err: any) => {
  console.error('[uncaughtException]', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason)
})
