import path from 'node:path'
import fs from 'node:fs'
import winston from 'winston'
import 'winston-daily-rotate-file'

const svcName = process.env.SVC_NAME || 'backend'
const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

// 统一时间格式（本地时区）
export function formatTime(d = new Date()): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  const Y = d.getFullYear(),
    M = pad(d.getMonth() + 1),
    D = pad(d.getDate())
  const h = pad(d.getHours()),
    m = pad(d.getMinutes()),
    s = pad(d.getSeconds())
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

// 多行友好 Console 格式（含堆栈、缩进后的 meta）
const prettyConsole = winston.format.printf(info => {
  const { level } = info
  const ts = info.timestamp || formatTime()
  const msg = info.message
  const stack = (info as any).stack
  // 去掉我们注入的内部字段避免双重输出
  const { timestamp, level: _l, message: _m, ...meta } = info as any

  const hasMeta = Object.keys(meta || {}).length > 0
  const metaStr = hasMeta ? JSON.stringify(meta, null, 2) : ''
  const lines: string[] = [`[${ts}] ${level}: ${msg}`]
  if (stack) lines.push(stack)
  if (hasMeta) lines.push(metaStr)
  return lines.join('\n')
})

// Console Transport：彩色 + 错误堆栈
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

// File（按天切分，JSON），用于检索/对接 ELK
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

export const appLogger = winston.createLogger({
  defaultMeta: { svc: svcName },
  transports: [consoleTransport, fileAll, fileError],
})

// 供 http-logger 创建“请求作用域”日志器（把 rid/method/url 等挂在 defaultMeta）
export function reqLogger(base: Record<string, any>) {
  const child = appLogger.child(base)
  return {
    info(msg: string, meta?: Record<string, any>) {
      child.info(msg, meta)
    },
    warn(msg: string, meta?: Record<string, any>) {
      child.warn(msg, meta)
    },
    error(msg: string, meta?: Record<string, any>) {
      child.error(msg, meta)
    },
    log(level: 'info' | 'warn' | 'error' | 'debug', msg: string, meta?: Record<string, any>) {
      ;(child as any).log(level, msg, meta)
    },
  }
}

/** 便捷封装（可选） */
export const AppLogger = {
  info(module: string, message: string, details?: any) {
    appLogger.info(message, { module, details })
  },
  warn(module: string, message: string, details?: any) {
    appLogger.warn(message, { module, details })
  },
  error(module: string, message: string, error?: Error, details?: any) {
    appLogger.error(message, { module, details, stack: (error as any)?.stack })
  },
  debug(module: string, message: string, details?: any) {
    ;(appLogger as any).debug?.(message, { module, details })
  },
}
