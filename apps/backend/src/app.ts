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

// 业务错误类型（可选）
import { HttpError } from '@/common/errors/http-error'

// 统一响应 & 请求ID & 日志等中间件
import { responseEnvelope } from '@/common/middleware/response'
import { optionalAuth } from '@/common/middleware/auth'
import { httpLogger } from '@/common/middleware/http-logger'
import { requestId } from '@/common/middleware/requestId'

// 路由（默认导出：Router 或 工厂函数）
import apiRoutesOrFactory from '@/routes'

// 启动期菜单同步
import { syncMenus } from './bootstrap/syncMenus'

// 时间格式
import { formatTime } from '@/infrastructure/logging/logger'

// 业务状态码（用于 errorHandler/fail 等）
import { CODES } from '@/types/response'

/** uploads 目录 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()

// 如在反向代理后（Nginx/Ingress），建议开启：可让 req.ip/secure 等更准确
app.set('trust proxy', true)

// 静态资源也挂在 /api 下，避免与前端路由冲突
app.use('/api/uploads', express.static(UPLOADS_DIR))

// —— 顺序很重要 —— //
// 1) 请求 ID（为统一响应/日志提供 requestId）
app.use(requestId())

// 2) 统一响应封装（挂载 res.ok / res.internal / res.fail...）
app.use(responseEnvelope())

// 3) CORS
const FRONTEND_ORIGIN = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
app.use(
    cors({
      origin: FRONTEND_ORIGIN,
      credentials: true,
    })
)

// 4) 解析体
app.use(cookieParser())
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// 5) 可选鉴权（解析 JWT，不强制）
app.use(optionalAuth)

// 6) 请求日志
app.use(httpLogger())

/** 健康检查（统一响应） */
app.get('/api/health', (_req: Request, res: Response) => {
  res.ok({ ok: true, time: formatTime() }, 'OK')
})

/** 将业务路由挂载到 /api */
async function mountRoutes() {
  const maybe = apiRoutesOrFactory as any
  const apiRouter = typeof maybe === 'function' && !(maybe.use && maybe.handle) ? await maybe() : maybe

  if (!apiRouter?.use || !apiRouter?.handle) {
    throw new Error('[@/routes] default export is neither an Express Router nor a factory returning a Router')
  }

  app.use('/api', apiRouter)
}

/** —— 未命中任何 /api 路由时返回 API 404（统一响应） —— */
const api404: RequestHandler = (_req, res) => {
  res.fail(CODES.NOT_FOUND, 404, '请求的资源不存在')
}

/** —— 统一错误处理（必须在所有路由/404 之后） —— */
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 如果 headers 已发送，交给默认处理（避免二次写头）
  if (res.headersSent) return

  const log = (req as any).log ?? console

  const isHttpErr =
      err instanceof HttpError ||
      (err && (err as any).name === 'HttpError') ||
      (err && (err as any).name === 'ValidationError')

  const status =
      (isHttpErr && (err as any).status) || (typeof (err as any)?.status === 'number' ? (err as any).status : 500)

  const code: string | undefined =
      (isHttpErr && (err as any).code) || (typeof (err as any)?.code === 'string' ? (err as any).code : undefined)

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

  // 统一输出：4xx/5xx
  const msg = (err as any)?.message || (status >= 500 ? '服务器内部错误' : '请求错误')
  if (status === 401) return res.unauthorized(msg, { code: code ?? CODES.AUTH_UNAUTHORIZED, error: { details } })
  if (status === 403) return res.forbidden(msg, { code: code ?? CODES.AUTH_FORBIDDEN, error: { details } })
  if (status === 404) return res.fail(code ?? CODES.NOT_FOUND, 404, msg, { error: { details } })
  if (status === 429) return res.tooMany(msg, { code: code ?? CODES.RATE_LIMITED, error: { details } })
  if (status >= 400 && status < 500) return res.badRequest(msg, { code: code ?? CODES.VALIDATION_ERROR, error: { details } })
  return res.internal(msg, { code: code ?? CODES.INTERNAL_ERROR, error: { details } })
}

/** 启动 */
const port = Number(process.env.PORT || 3000)

async function start() {
  try {
    await mountRoutes()

    // 404 放在所有 /api 路由之后
    app.use('/api', api404)

    // 错误处理放最后
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
