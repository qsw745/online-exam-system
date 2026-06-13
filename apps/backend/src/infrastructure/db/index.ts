/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/backend/src/infrastructure/db/index.ts
// 目标：统一时区，确保 DB 端 CURRENT_TIMESTAMP/NOW() 与应用展示一致。

import '@/config/env'
import { createPool, type Pool } from 'mysql2/promise'
import { enableSqlDebug } from '@/config/sql-debug'

// ✅ 本地 shim
declare const process: any

// ---- 时区策略 ----
// 可选：DB_TZ='+08:00'（中国大陆单时区）或 '+00:00'/'Z'（UTC 存储）
const DB_TZ = String(process.env.DB_TZ ?? '+08:00')

// 环境变量检查
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error('[DB] 缺少必要的数据库配置：DB_HOST/DB_USER/DB_PASSWORD/DB_NAME')
  process.exit(1)
}

// 统一连接池（promise 版）
export const pool: Pool = createPool({
  host: process.env.DB_HOST as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME as string,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT ?? 10),
  queueLimit: 0,

  // 避免 Node 进程/容器时区对日期解析的二次影响
  dateStrings: true,

  decimalNumbers: true,
  multipleStatements: false,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',

  // 仅影响驱动对 JS Date <-> SQL 的转换；DB 会话时区仍需 SET time_zone
  timezone: DB_TZ,
})

// 初始化：测试连接 + 设置一次会话时区（这一步拿到的是 PromisePoolConnection，可以 await）
pool
  .getConnection()
  .then(async conn => {
    try {
      await conn.query('SET time_zone = ?', [DB_TZ])
      const [vars] = await conn.query<any[]>(
        'SELECT @@global.time_zone AS global_tz, @@session.time_zone AS session_tz, @@system_time_zone AS system_tz'
      )
      console.log(
        `[DB] 数据库连接成功 | global_tz=${vars?.[0]?.global_tz} | session_tz=${vars?.[0]?.session_tz} | system_tz=${vars?.[0]?.system_tz} | DB_TZ=${DB_TZ}`
      )
    } finally {
      conn.release()
    }
  })
  .catch(err => {
    console.error('[DB] 数据库连接失败:', (err as Error).message)
    process.exit(1)
  })

// 对每个**新建**的底层连接设置会话时区（注意：这里拿到的是“回调版连接”）
;(pool as any).on?.('connection', (conn: any) => {
  // 方案 A：直接使用回调式 query（不要 await）
  conn.query('SET time_zone = ?', [DB_TZ], (err: any) => {
    if (err) console.error('[DB] 设定会话时区失败:', err?.message || err)
  })

  // 也可以用 方案 B：conn.promise().query(...) —— 但不要在这里 await
  // conn.promise().query('SET time_zone = ?', [DB_TZ]).catch((e: any) => {
  //   console.error('[DB] 设定会话时区失败:', e?.message || e)
  // })

  conn.on?.('error', (err: any) => {
    console.error('[DB] MySQL connection error:', err)
    const code = err?.code as string | undefined
    if (code === 'PROTOCOL_CONNECTION_LOST') console.error('[DB] 数据库连接丢失')
    else if (code === 'ER_CON_COUNT_ERROR') console.error('[DB] 数据库连接过多')
    else if (code === 'ECONNREFUSED') console.error('[DB] 数据库连接被拒绝')
  })
})

// SQL 调试
enableSqlDebug(pool)
