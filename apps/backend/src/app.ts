// apps/backend/src/app.ts
import express, { type NextFunction, type Request, type Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

// 用 createRequire 以 CJS 方式加载中间件，避免个别 @types 包的 ESM/CJS 差异
const require = createRequire(import.meta.url)
// 关键：这里统一用 any，避免触发 2306 / 7016
const cors = require('cors') as any
const morgan = require('morgan') as any

// 统一 API 路由入口（对应 src/routes/index.ts 编译后的 ./routes/index.js）
import apiRouter from './routes/index.js'

// 启动期菜单同步 —— 使用相对路径更稳妥（避免别名在 NodeNext 下解析失败）
import { syncMenus } from './bootstrap/syncMenus.js'

// 简易响应类型
type ApiResponse<T> = { success: boolean; data?: T | null; error?: string }

// 兼容 __dirname（可选）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* --------- 给 console 输出加时间戳 --------- */
;(function patchConsoleWithTimestamp() {
  if ((global as any).__console_ts_patched) return
  ;(global as any).__console_ts_patched = true

  function formatDate() {
    const d = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds())
    )
  }

  const withTs = <T extends (...args: any[]) => any>(fn: T): T =>
    ((...args: any[]) => fn.apply(console, [`[${formatDate()}]`, ...args])) as T

  console.log = withTs(console.log.bind(console))
  console.info = withTs(console.info?.bind(console) ?? console.log.bind(console))
  console.warn = withTs(console.warn.bind(console))
  console.error = withTs(console.error.bind(console))
  console.debug = withTs(console.debug?.bind(console) ?? console.log.bind(console))
})()

// 自定义 morgan token（morgan 现在是 any，直接调用即可）
morgan.token('local-date', () => {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  )
})

const app = express()

/* -------------------- 全局中间件 -------------------- */
app.use(cors())
app.use(express.json())
app.use(morgan(':local-date :method :url :status :response-time ms - :res[content-length]'))

// 静态文件（头像/上传等）
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

/* -------------------- 路由：集中入口 -------------------- */
app.use('/api', apiRouter)

// 健康检查
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

/* -------------------- 404 -------------------- */
app.use((req: Request, res: Response<ApiResponse<null>>) => {
  res.status(404).json({ success: false, error: '请求的资源不存在' })
})

/* -------------------- 全局错误处理 -------------------- */
app.use((err: Error, _req: Request, res: Response<ApiResponse<null>>, _next: NextFunction) => {
  console.error('未捕获的错误:', err)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

/* -------------------- 进程级兜底 -------------------- */
process.on('uncaughtException', err => {
  console.error('未捕获的异常:', err)
  process.exit(1)
})

process.on('unhandledRejection', reason => {
  console.error('未处理的 Promise 拒绝:', reason)
})

/* -------------------- 启动 -------------------- */
const port = Number(process.env.PORT) || 3000

async function start() {
  try {
    // 启动期同步菜单（首次建议 removeOrphans: false）
    await syncMenus({ removeOrphans: false, mode: 'patch' })

    app.listen(port, '0.0.0.0', () => {
      console.log(`服务器运行在 http://localhost:${port}`)
      console.log(`网络访问地址: http://0.0.0.0:${port}`)
    })
  } catch (err) {
    console.error('[menu-sync] 启动期同步失败：', err)
    process.exit(1)
  }
}

start()
