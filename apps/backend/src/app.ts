// apps/backend/src/app.ts
import express, { type NextFunction, type Request, type Response } from 'express'
import { logUserRoles } from './common/middleware/debug-roles.js'

// 动态导入第三方中间件，统一 any，绕过类型声明分歧
const corsMod: any = await import('cors')
const morganMod: any = await import('morgan')
const cors: any = corsMod?.default ?? corsMod
const morgan: any = morganMod?.default ?? morganMod

// 子路由（指向 src/routes/index.ts 编译产物）
import apiRouter from './routes/index.js'

// 启动期菜单同步
import { syncMenus } from './bootstrap/syncMenus.js'

// 简易响应类型
type ApiResponse<T> = { success: boolean; data?: T | null; error?: string }

/* --------- 给 console 输出加时间戳（使用 globalThis 避免 Node 类型依赖） --------- */
;(function patchConsoleWithTimestamp() {
  const g: any = globalThis as any
  if (g.__console_ts_patched) return
  g.__console_ts_patched = true

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
  console.info = withTs((console as any).info?.bind(console) ?? console.log.bind(console))
  console.warn = withTs(console.warn.bind(console))
  console.error = withTs(console.error.bind(console))
  console.debug = withTs((console as any).debug?.bind(console) ?? console.log.bind(console))
})()

// 自定义 morgan token（morgan 为 any，直接调用）
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

/* -------------------- 创建 app -------------------- */
const app = express()

/* -------------------- 全局中间件 -------------------- */
app.use((cors as any)())
app.use(express.json())
app.use(morgan(':local-date :method :url :status :response-time ms - :res[content-length]'))

// 静态文件（头像/上传等）— 使用相对路径即可，避免依赖 path/url 类型
app.use('/uploads', express.static('uploads'))

// 开发期调试日志（打印 token/角色等）
app.use(logUserRoles)

/* -------------------- 调试：当前登录身份与角色解析 -------------------- */
// 说明：为避免你去修改 role-auth 导出，这里内联一个与 requireRoleByIds 同源的解析逻辑
app.get('/api/__debug/whoami', (req, res) => {
  const user: any = (req as any).user ?? null

  const ROLE_IDS = { SUPER_ADMIN: 1, ADMIN: 2, TEACHER: 3, STUDENT: 4 } as const
  const ROLE_CODE_TO_ID: Record<string, number> = {
    super_admin: ROLE_IDS.SUPER_ADMIN,
    superadmin: ROLE_IDS.SUPER_ADMIN,
    admin: ROLE_IDS.ADMIN,
    teacher: ROLE_IDS.TEACHER,
    student: ROLE_IDS.STUDENT,
  }

  function extractUserRoleIds(u: any): number[] {
    const ids = new Set<number>()
    if (!u) return []

    const rawIds: unknown = u.role_ids ?? u.roleIds ?? u.roles_ids ?? u.rolesIds
    if (Array.isArray(rawIds)) {
      for (const v of rawIds) {
        const n = typeof v === 'string' ? parseInt(v, 10) : v
        if (Number.isFinite(n)) ids.add(n as number)
      }
    }

    const rawCodes: unknown = u.role_codes ?? u.roleCodes ?? u.roles_codes ?? u.rolesCodes
    if (Array.isArray(rawCodes)) {
      for (const c of rawCodes) {
        const code = String(c || '').toLowerCase()
        const id = ROLE_CODE_TO_ID[code]
        if (id) ids.add(id)
      }
    }

    const rawRoles: unknown = u.roles
    if (Array.isArray(rawRoles)) {
      for (const r of rawRoles) {
        const id = Number((r as any).id)
        if (Number.isFinite(id)) ids.add(id)
        const code = String((r as any).code || '').toLowerCase()
        const mapped = ROLE_CODE_TO_ID[code]
        if (mapped) ids.add(mapped)
      }
    }

    if (u?.is_super_admin || u?.isSuperAdmin) {
      ids.add(ROLE_IDS.SUPER_ADMIN)
    }
    return Array.from(ids)
  }

  res.json({
    ok: true,
    user,
    extractedRoleIds: extractUserRoleIds(user),
  })
})

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

/* -------------------- 进程级兜底（通过 globalThis 获取 process，避免类型依赖） -------------------- */
const proc: any = (globalThis as any).process

proc?.on?.('uncaughtException', (err: unknown) => {
  console.error('未捕获的异常:', err)
  proc?.exit?.(1)
})

proc?.on?.('unhandledRejection', (reason: unknown) => {
  console.error('未处理的 Promise 拒绝:', reason)
})

/* -------------------- 启动 -------------------- */
const port = Number(proc?.env?.PORT) || 3000

async function start() {
  try {
    // 启动期同步菜单（首次建议 removeOrphans: false）
    await syncMenus({ removeOrphans: false, mode: 'patch' })

    app.listen(port, '0.0.0.0', () => {
      console.log(`服务器运行在 http://localhost:${port}`)
      console.log(`网络访问地址: http://0.0.0.0:${port}`)
    })
  } catch (err: unknown) {
    console.error('[menu-sync] 启动期同步失败：', err)
    proc?.exit?.(1)
  }
}

start()
