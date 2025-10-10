/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/backend/src/infrastructure/db/index.ts
// 修复要点：dotenv 用默认导入（结合 esModuleInterop），避免 TS2306。
//           使用 mysql2/promise 的 createPool，确保 Promise Pool 类型带有 query/execute。

import dotenv from 'dotenv'
import { createPool, type Pool } from 'mysql2/promise'
import { enableSqlDebug } from '@/config/sql-debug'

dotenv.config()

// 基础环境变量检查
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error('[DB] 缺少必要的数据库配置环境变量：DB_HOST/DB_USER/DB_PASSWORD/DB_NAME')
  process.exit(1)
}

// —— 创建 promise 版连接池 ——
// 注意：来自 `mysql2/promise`，返回的 Pool（PromisePool）自带 query/execute（Promise 风格）
export const pool: Pool = createPool({
  host: process.env.DB_HOST as string,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME as string,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT ?? 10),
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
  multipleStatements: false,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+08:00',
})

// 测试数据库连接
pool
  .getConnection()
  .then(conn => {
    console.log('[DB] 数据库连接成功')
    conn.release()
  })
  .catch(err => {
    console.error('[DB] 数据库连接失败:', (err as Error).message)
    process.exit(1)
  })

// 监听连接错误（类型声明里未必包含 .on，这里用 any 兜一下调试用场景）
;(pool as any).on?.('connection', (conn: any) => {
  conn.on?.('error', (err: any) => {
    console.error('[DB] MySQL connection error:', err)
    const code = err?.code as string | undefined
    if (code === 'PROTOCOL_CONNECTION_LOST') console.error('[DB] 数据库连接丢失')
    else if (code === 'ER_CON_COUNT_ERROR') console.error('[DB] 数据库连接数过多')
    else if (code === 'ECONNREFUSED') console.error('[DB] 数据库连接被拒绝')
  })
})

// 打开 SQL 调试（由环境变量控制）
enableSqlDebug(pool)
