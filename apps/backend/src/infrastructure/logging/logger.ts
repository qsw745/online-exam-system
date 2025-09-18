// apps/backend/src/infrastructure/logging/logger.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'node:path'
import fs from 'node:fs'
import winston from 'winston'
import 'winston-daily-rotate-file'

const svcName = process.env.SVC_NAME || 'backend'
const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

/** 本地时区时间 */
export function formatTime(d = new Date()): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  const Y = d.getFullYear(), M = pad(d.getMonth() + 1), D = pad(d.getDate())
  const h = pad(d.getHours()), m = pad(d.getMinutes()), s = pad(d.getSeconds())
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

/** Console 友好多行格式 */
const prettyConsole = winston.format.printf(info => {
  const ts = info.timestamp || formatTime()
  const lvl = info.level
  const msg = info.message
  const { timestamp, level, message, ...meta } = info as any
  const stack = (info as any).stack
  const metaStr = Object.keys(meta || {}).length ? JSON.stringify(meta, null, 2) : ''
  const lines = [`[${ts}] ${lvl}: ${msg}`]
  if (stack) lines.push(stack)
  if (metaStr) lines.push(metaStr)
  return lines.join('\n')
})

/** Console 输出（彩色 + 堆栈） */
const consoleTransport = new winston.transports.Console({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: formatTime }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      prettyConsole
  ),
})

/** 文件输出（按日切分，JSON） */
const fileCommon = {
  dirname: LOG_DIR,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_RETENTION || '14d',
}
const fileAll = new (winston.transports as any).DailyRotateFile({
  ...fileCommon,
  filename: '%DATE%.log',
  level: process.env.FILE_LOG_LEVEL || 'info',
  format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
  ),
})
const fileError = new (winston.transports as any).DailyRotateFile({
  ...fileCommon,
  filename: '%DATE%-error.log',
  level: 'error',
  format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
  ),
})

/** 基础 winston logger */
export const appLogger = winston.createLogger({
  defaultMeta: { svc: svcName },
  transports: [consoleTransport, fileAll, fileError],
})

type Level = 'error' | 'warn' | 'info' | 'debug'
type Fields = Record<string, any>

/** 将 Error/异常序列化成结构化对象 */
function serializeError(e: any) {
  if (!e) return undefined
  if (e instanceof Error) {
    const out: any = { name: e.name, message: e.message, stack: e.stack }
    if ((e as any).code) out.code = (e as any).code
    if ((e as any).status) out.status = (e as any).status
    if ((e as any).details) out.details = (e as any).details
    if ((e as any).ctx) out.ctx = (e as any).ctx
    return out
  }
  // 兜底：普通对象也尽量带出 message/stack
  return typeof e === 'object' ? { ...e } : { value: e }
}

/** 统一发送逻辑：支持多种调用签名 */
function send(w: winston.Logger, bound: Fields, level: Level, a?: any, b?: any) {
  // 1) error-only: log.error(err)
  if (a instanceof Error && b === undefined) {
    return w.log(level, a.message || 'Error', { ...bound, error: serializeError(a) })
  }
  // 2) string + error/meta: log.error('msg', errOrMeta)
  if (typeof a === 'string') {
    const msg = a
    const meta = b instanceof Error ? { error: serializeError(b) } : (b || {})
    return w.log(level, msg, { ...bound, ...meta })
  }
  // 3) object-only: log.info({ foo: 1 }) => msg 为空，纯 meta
  if (a && typeof a === 'object') {
    return w.log(level, '', { ...bound, ...a })
  }
  // 4) 无参
  return w.log(level, '')
}

/** 包装为轻量 facade（支持 .with() / .startTimer() / 基本等级） */
function wrap(logger: winston.Logger, bound: Fields = {}) {
  const api = {
    info: (a?: any, b?: any) => send(logger, bound, 'info', a, b),
    warn: (a?: any, b?: any) => send(logger, bound, 'warn', a, b),
    error: (a?: any, b?: any) => send(logger, bound, 'error', a, b),
    debug: (a?: any, b?: any) => send(logger, bound, 'debug', a, b),
    log: (level: Level, a?: any, b?: any) => send(logger, bound, level, a, b),
    /** 绑定上下文字段（不可变，返回新实例） */
    with(fields: Fields) {
      return wrap(logger.child(fields), { ...bound, ...fields })
    },
    child(fields: Fields) {
      return this.with(fields)
    },
    /** 计时器：const t = log.startTimer(); ...; t.done('msg') */
    startTimer() {
      const start = (process as any)?.hrtime?.bigint ? (process as any).hrtime.bigint() : (process as any).hrtime?.()
      const diffMs = () => {
        try {
          if (typeof start === 'bigint' && (process as any)?.hrtime?.bigint) {
            const ns = (process as any).hrtime.bigint() - start
            return Number(ns / BigInt(1_000_000))
          }
          if ((process as any)?.hrtime) {
            const d = (process as any).hrtime(start)
            return Math.round(d[0] * 1e3 + d[1] / 1e6)
          }
        } catch {}
        return undefined
      }
      return {
        done: (msg = 'done', level: Level = 'info', meta?: any) =>
            send(logger, { ...bound, durationMs: diffMs() }, level, msg, meta),
      }
    },
  }
  return api
}

/** 默认全局简洁日志器：log.info()/log.error() 可直接用 */
export const log = wrap(appLogger)

/** 兼容旧的工厂：logger(base) -> 返回带默认上下文的日志器 */
export function logger(base: Fields) {
  return wrap(appLogger.child(base), base)
}

/** 请求作用域日志器：优先使用 http-logger 注入的 req.log；否则自动构造 */
export function getReqLogger(req?: any, extra?: Fields) {
  if (req?.log && typeof req.log.info === 'function') {
    return wrap(req.log, extra ? extra : {})
  }
  const base: Fields = {
    rid: (req && (req.id || req.headers?.['x-request-id'])) || undefined,
    method: req?.method,
    url: req?.originalUrl || req?.url,
    ip: (req && (req.clientIp || req.ip)) || undefined,
  }
  return wrap(appLogger.child({ ...base, ...(extra || {}) }), { ...base, ...(extra || {}) })
}

/** 便捷别名（仍保留，以减少改动量） */
export const AppLogger = {
  info(module: string, message: string, details?: any) {
    appLogger.info(message, { module, details })
  },
  warn(module: string, message: string, details?: any) {
    appLogger.warn(message, { module, details })
  },
  error(module: string, message: string, error?: Error, details?: any) {
    appLogger.error(message, { module, details, error: serializeError(error) })
  },
  debug(module: string, message: string, details?: any) {
    ;(appLogger as any).debug?.(message, { module, details })
  },
}
