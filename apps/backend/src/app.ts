/* eslint-disable @typescript-eslint/no-explicit-any */

// 这里不要声明 process:any；如果你还没装 @types/node，下面的 shims.d.ts 会提供声明

import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express'

// 兼容无 @types/node 的项目：使用经典模块名（非 node:*）
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import 'source-map-support/register'
import 'tsconfig-paths/register'
import { redisReady, isRedisReady } from '@/common/redis/client'

// 业务错误类型
import { HttpError } from '@/common/errors/http-error'

// 统一响应 & 请求ID & 日志等中间件
import { optionalAuth } from '@/common/middleware/auth'
import { httpLogger } from '@/common/middleware/http-logger'
import { requestId } from '@/common/middleware/requestId'
import { responseEnvelope } from '@/common/middleware/response'

// 路由（默认导出：Router 或 工厂函数）
import apiRoutesOrFactory from '@/routes'

// 启动期菜单同步
import { syncMenus } from './bootstrap/syncMenus'

// 时间格式
import { formatTime, log } from '@/infrastructure/logging/logger'

import { CODES } from '@/types/response'

/** uploads 目录 */
const UPLOADS_DIR = (process as any).env?.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
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
const FRONTEND_ORIGIN = String((process as any).env?.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
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
  if (!isRedisReady()) {
    return res.status(503).json({ ok: false, reason: 'redis_not_ready', time: formatTime() })
  }
  return res.ok({ ok: true, time: formatTime() }, 'OK')
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

/** 是否在响应体中暴露堆栈（用 req.get 读取 header，避免某些类型环境下的 req.headers 报错） */
function shouldExposeStack(req: Request) {
  const isProd = (process as any).env?.NODE_ENV === 'production'
  const debugHeader = (req.get('x-debug') || req.get('x-debug-stack') || '').toString().trim()
  return !isProd || debugHeader === '1' || debugHeader.toLowerCase() === 'true'
}

/** 从错误对象萃取常见 SQL 元信息 */
function extractSqlish(err: any) {
  if (!err) return undefined
  const hasAny = err?.code || err?.errno || err?.sqlState || err?.sql || err?.sqlMessage
  if (!hasAny) return undefined
  return {
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState || err.sqlstate,
    sqlMessage: err.sqlMessage || err.message,
    sql: err.sql,
    parameters: err.parameters || err.values,
  }
}

/** 提取首个“业务栈帧”（忽略 node/node_modules） */
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

/** 安全 JSON（日志使用） */
function safeJson(obj: any, max = 4000) {
  try {
    const s = JSON.stringify(obj)
    return s.length > max ? s.slice(0, max) + '…(truncated)' : s
  } catch {
    return undefined
  }
}

/** —— 统一错误处理（必须在所有路由/404 之后） —— */
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return
  const logger = (req as any).log ?? console
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
  const exposeStack = shouldExposeStack(req)
  const sql = extractSqlish(err)

  const short =
    `[error-handler] ${(err as any)?.name || 'Error'}: ${String((err as any)?.message ?? err)}` +
    (top ? ` @/ ${top.file}:${top.line}:${top.column}${top?.method ? ` (${top.method})` : ''}` : '')

  const reqDump =
    req.method === 'GET' || req.method === 'HEAD'
      ? { params: req.params, query: req.query }
      : { params: req.params, query: req.query, body: safeJson(req.body) }

  logger[status >= 500 ? 'error' : 'warn']?.('controller error', {
    rid: (req as any).id ?? null,
    method: req.method,
    url: (req as any).originalUrl || req.url,
    routePath: (req as any).route?.path || null,
    handler: (req as any).__handlerName ?? null,
    short,
    error: {
      type: (err as any)?.name,
      message: String((err as any)?.message ?? err),
      code,
      status,
      details,
      ctx,
      sql,
      topFrame: top || undefined,
      stack: exposeStack ? (err as any)?.stack : undefined,
    },
    request: reqDump,
  })

  const msg = (err as any)?.message || (status >= 500 ? '服务器内部错误' : '请求错误')
  const errorPayload = {
    type: (err as any)?.name,
    message: msg,
    code,
    status,
    details,
    ctx,
    sql,
    where: top || undefined,
    stack: exposeStack ? (err as any)?.stack : undefined,
    routePath: (req as any).route?.path || undefined,
    handler: (req as any).__handlerName || undefined,
    requestId: (req as any).id || undefined,
  }

  if (status === 401) return res.unauthorized(msg, { code: code ?? CODES.AUTH_UNAUTHORIZED, error: errorPayload })
  if (status === 403) return res.forbidden(msg, { code: code ?? CODES.AUTH_FORBIDDEN, error: errorPayload })
  if (status === 404) return res.fail(code ?? CODES.NOT_FOUND, 404, msg, { error: errorPayload })
  if (status === 429) return res.tooMany(msg, { code: code ?? CODES.RATE_LIMITED, error: errorPayload })
  if (status >= 400 && status < 500)
    return res.badRequest(msg, { code: code ?? CODES.VALIDATION_ERROR, error: errorPayload })
  return res.internal(msg, { code: code ?? CODES.INTERNAL_ERROR, error: errorPayload })
}

/** —— 端口诊断（Windows 专用） —— */
function diagnoseWindowsPort(port: number) {
  try {
    if ((process as any).platform !== 'win32') return
    log.error('[diagnose] Windows 检测：开始快速排查…')
    try {
      const out = execSync('netsh int ipv4 show excludedportrange protocol=tcp', { encoding: 'utf8' } as any) as string
      const ranges: Array<[number, number]> = []
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().match(/^(\d+)\s+(\d+)$/)
        if (m) ranges.push([Number(m[1]), Number(m[2])])
      }
      const hit = ranges.find(([s, e]) => port >= s && port <= e)
      if (hit) {
        log.error(`[diagnose] 端口 ${port} 位于系统保留区间 ${hit[0]}-${hit[1]}（excludedportrange）.`)
        log.error('[diagnose] 常见原因：Hyper-V/WSL/ICS/NAT 服务保留。可尝试（管理员 PowerShell）：')
        log.error('    net stop winnat && net start winnat')
        log.error('    sc stop SharedAccess && sc start SharedAccess')
      }
    } catch {}
    try {
      const out2 = execSync(`cmd /c netstat -ano -p tcp | findstr ":${port}"`, { encoding: 'utf8' } as any) as string
      if (out2?.trim()) {
        log.error('[diagnose] netstat 检测到可能占用：')
        log.error(out2)
        log.error('[diagnose] 可执行：taskkill /PID <pid> /F')
      } else {
        log.error('[diagnose] netstat 未发现监听，同样可能是“系统保留端口/权限策略”。')
      }
    } catch {
      log.error('[diagnose] netstat 未发现监听，同样可能是“系统保留端口/权限策略”。')
    }
  } catch {}
}

/** 启动（固定端口策略 + 单例监听防抖） */
const port = Number((process as any).env?.PORT || 3000)
const HOST = String((process as any).env?.HOST || '0.0.0.0')
const LISTEN_FLAG = '__OES_SERVER_ALREADY_LISTENING__'

async function start() {
  try {
    // 关键：阻塞到 Redis ready；失败会在 client.ts 里直接 exit(1)
    await redisReady

    await mountRoutes()

    // 404 放在所有 /api 路由之后
    app.use('/api', api404)

    // 错误处理放最后
    app.use(errorHandler)

    await syncMenus?.({ removeOrphans: false, mode: 'patch' }).catch((e: any) => {
      log.warn('[menu-sync] failed at boot:', e?.message || e)
    })

    if ((globalThis as any)[LISTEN_FLAG]) {
      log.warn('[boot] listen skipped: already listening in this process (duplicate import)')
      return
    }
    ;(globalThis as any)[LISTEN_FLAG] = true

    const server = app.listen(port, HOST, () => {
      const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST
      console.log(`[boot] server at http://${shownHost}:${port} (${HOST}:${port})`)
      console.log(`[boot] uploads dir = ${UPLOADS_DIR}`)
    })

    server.on('error', (err: any) => {
      const code = err?.code
      const addr = (err as any)?.address ?? HOST
      const prt = (err as any)?.port ?? port
      if (code === 'EADDRINUSE' || code === 'EACCES') {
        console.error(`[boot] 监听失败：${addr}:${prt} -> ${code} (${err?.message || 'permission denied'})`)
        if ((process as any).platform === 'win32' && code === 'EACCES') {
          diagnoseWindowsPort(prt)
        }
        console.error(`[boot] 固定端口策略：不切换端口。请释放/解除限制后重试。`)
        console.error(`[hint] Windows: netstat -ano | findstr ":${prt}"  ->  taskkill /PID <pid> /F`)
        ;(process as any).exit?.(1)
      } else {
        console.error('[boot] listen error:', err)
        ;(process as any).exit?.(1)
      }
    })
  } catch (e) {
    console.error('[boot] failed:', e)
    ;(process as any).exit?.(1)
  }
}

start()

export default app
