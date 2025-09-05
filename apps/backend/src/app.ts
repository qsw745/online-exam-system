// apps/backend/src/app.ts
import 'dotenv/config'
import 'source-map-support/register'

import express, { type NextFunction, type Request, type Response } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import cookieParser from 'cookie-parser' 
// 中间件
import { requestId } from './common/middleware/requestId.js'
import { httpLogger } from './common/middleware/http-logger.js'
import { optionalAuth } from './common/middleware/auth.js'

// 路由
import apiRouter from './routes/index.js'

// 启动期菜单同步
import { syncMenus } from './bootstrap/syncMenus.js'

// 时间格式
import { formatTime } from './infrastructure/logging/logger.js'

type ApiResponse<T> = { success: boolean; data?: T | null; error?: string; details?: any }

/**
 * 与 upload.ts 保持一致的目录策略：
 * 1) 优先用 UPLOADS_DIR
 * 2) 否则回落到 <进程工作目录>/uploads
 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()

// 静态资源：/uploads/** -> UPLOADS_DIR
app.use('/uploads', express.static(UPLOADS_DIR))

// 顺序很重要
app.use(requestId())

// CORS
const corsMod: any = await import('cors')
const cors: any = corsMod?.default ?? corsMod
const FRONTEND_ORIGIN = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
app.use(
  (cors as any)({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
)
app.use(cookieParser())
app.use(express.json({ limit: '5mb' }))
app.use(optionalAuth)
app.use(httpLogger())

app.use('/api', apiRouter)

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: formatTime() })
})

// 兜底 404（API）
app.use((req: Request, res: Response<ApiResponse<null>>) => {
  res.status(404).json({ success: false, error: '请求的资源不存在' })
})

/** ====== 辅助：从堆栈里挑选第一条业务帧（文件+行列+方法） ====== */
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

// 统一错误处理
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

process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err)
  process.exit(1)
})
process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection]', reason)
})

const port = Number(process.env.PORT || 3000)
async function start() {
  try {
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
