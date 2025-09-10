/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: any

import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'
import 'source-map-support/register'
import 'tsconfig-paths/register'

// ⬇️ 新增：识别业务错误并透传状态码/错误码/详情
import { HttpError } from '@/common/errors/http-error'

// 中间件
import { optionalAuth } from '@/common/middleware/auth'
import { httpLogger } from '@/common/middleware/http-logger'
import { requestId } from '@/common/middleware/requestId'

// 路由（默认导出：Router 或 工厂函数）
import apiRoutesOrFactory from '@/routes'

// 启动期菜单同步
import { syncMenus } from './bootstrap/syncMenus'

// 时间格式
import { formatTime } from '@/infrastructure/logging/logger'

type ApiResponse<T> = { success: boolean; data?: T | null; error?: string; details?: any }

/** uploads 目录 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()

// 如在反向代理后（Nginx/Ingress），建议开启：可让 req.ip/secure 等更准确
app.set('trust proxy', true)

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
app.use(express.urlencoded({ extended: true, limit: '5mb' }))
app.use(optionalAuth)
app.use(httpLogger())

/** 健康检查（放在 /api 下） */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: formatTime() })
})

/** —— 未命中任何 /api 路由时返回 API 404 —— */
const api404: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, error: '请求的资源不存在' })
}

/** —— 统一错误处理（必须在所有路由/404 之后） —— */
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const log = (req as any).log ?? console

  // 识别 HttpError/ValidationError
  const isHttpErr =
    err instanceof HttpError ||
    (err && (err as any).name === 'HttpError') ||
    (err && (err as any).name === 'ValidationError')

  const status =
    (isHttpErr && (err as any).status) || (typeof (err as any)?.status === 'number' ? (err as any).status : 500)

  const code = (isHttpErr && (err as any).code) || (err as any)?.code
  const details = (isHttpErr && (err as any).details) || (err as any)?.details
  const ctx = (isHttpErr && (err as any).ctx) || (err as any)?.ctx

  ;(req as any).onError?.(err)

  const top = pickTopBusinessFrame((err as any)?.stack)
  const short =
    `[error-handler] ${(err as any)?.name || 'Error'}: ${String((err as any)?.message ?? err)}` +
    (top ? ` @/ ${top.file}:${top.line}:${top.column}${top.method ? ` (${top.method})` : ''}` : '')

  const reqDump =
    req.method === 'GET' || req.method === 'HEAD'
      ? { params: req.params, query: req.query }
      : { params: req.params, query: req.query, body: safeJson(req.body) }

  log[status >= 500 ? 'error' : 'warn']?.(short, {
    rid: (req as any).id ?? null,
    method: req.method,
    url: (req as any).originalUrl || req.url,
    routePath: (req as any).route?.path || null,
    handler: (req as any).__handlerName ?? null,
    error: {
      type: (err as any)?.name,
      message: String((err as any)?.message ?? err),
      stack: (err as any)?.stack,
      code,
      status,
      details,
      ctx,
    },
    request: reqDump,
  })

  // 对前端/网关友好的响应头
  if (code) res.setHeader('X-Error-Code', String(code))
  if ((req as any).id) res.setHeader('X-Request-Id', String((req as any).id))

  res.status(status).json({
    success: false,
    error: (err as any)?.message || '服务器内部错误',
    ...(code ? { code } : null),
    ...(details ? { details } : null),
  })
}

/** 启动 */
const port = Number(process.env.PORT || 3000)
async function start() {
  try {
    // 兼容两种导出：Router 或 工厂函数
    const maybe = apiRoutesOrFactory as any
    const apiRouter = typeof maybe === 'function' && !(maybe.use && maybe.handle) ? await maybe() : maybe

    if (!apiRouter?.use || !apiRouter?.handle) {
      throw new Error('[@/routes] default export is neither an Express Router nor a factory returning a Router')
    }

    // 统一前缀
    app.use('/api', apiRouter)

    // ✅ 明确是 RequestHandler，避免被当作 PathParams 重载
    app.use('/api', api404)

    // ✅ 明确是 ErrorRequestHandler
    app.use(errorHandler)

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
